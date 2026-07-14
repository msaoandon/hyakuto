import { Hono } from "hono";
import { Auth } from "@auth/core";
import { prisma } from "../db";
import { appOrigins } from "../env";
import { buildAuthConfig, type DanceSession } from "./config";
import { mintSession, resolveSession, revokeSession } from "./sessions";
import { newLoginCode, sha256, LOGIN_CODE_TTL_MS } from "./tokens";

// The auth surface. Three layers:
//   1. Auth.js catch-all (/signin, /callback/:provider, /csrf, /session …) —
//      the OAuth dance itself, driven entirely by @auth/core.
//   2. Our bookends: /start (app → dance, server-side CSRF handshake so the
//      static client can just navigate here) and /complete (dance → app,
//      trades the seconds-old Auth.js cookie for a single-use login code).
//   3. Token endpoints: /guest (a session with no OAuth at all), /token (code →
//      bearer token, where guest adoption happens), DELETE /session (sign-out).
// The bearer token itself NEVER rides a URL — redirects carry only the 60s
// single-use code; the token travels in the POST /token response body.

export const auth = new Hono();

/** First-party cookie pairs ("a=1; b=2") from a Response's Set-Cookie headers. */
function cookiePairs(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((sc) => sc.split(";")[0]!)
    .join("; ");
}

/** A return target must be a URL inside an allow-listed app origin — login
 *  codes are never redirected anywhere else. (The Capacitor deep-link scheme
 *  joins this list when the native pass lands.) */
function validReturn(target: string | undefined): string | null {
  if (!target) return null;
  try {
    return appOrigins().includes(new URL(target).origin) ? target : null;
  } catch {
    return null;
  }
}

// Guests get real sessions: a guest is a player with no linked account, not an
// unauthenticated code path. One auth model for every request.
auth.post("/guest", async (c) => {
  const player = await prisma.player.create({ data: {} });
  const token = await mintSession(player.id);
  return c.json({ token }, 201);
});

// App → dance. Runs the CSRF handshake server-side (fetch /csrf, POST /signin
// with the token + cookie) and relays the provider redirect plus every cookie
// Auth.js set, so the client's entire job is `location = /start/google?return=…`.
auth.get("/start/:provider", async (c) => {
  const provider = c.req.param("provider");
  const returnTo = validReturn(c.req.query("return"));
  if (!returnTo) return c.json({ error: "return must be a URL on an allowed app origin" }, 400);

  const config = buildAuthConfig();
  if (!config.providers.some((p) => (typeof p === "function" ? p().id : p.id) === provider)) {
    return c.json({ error: `provider "${provider}" is not configured` }, 400);
  }

  const origin = new URL(c.req.url).origin;
  const csrfRes = await Auth(new Request(`${origin}/v1/auth/csrf`), config);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const callbackUrl = `${origin}/v1/auth/complete?return=${encodeURIComponent(returnTo)}`;
  const signinRes = await Auth(
    new Request(`${origin}/v1/auth/signin/${provider}`, {
      method: "POST",
      headers: {
        cookie: cookiePairs(csrfRes),
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ csrfToken, callbackUrl }),
    }),
    config,
  );

  const location = signinRes.headers.get("location");
  if (!location || signinRes.status !== 302) {
    return c.json({ error: `sign-in initiation failed (auth.js responded ${signinRes.status})` }, 500);
  }
  const headers = new Headers({ location });
  for (const sc of [...csrfRes.headers.getSetCookie(), ...signinRes.headers.getSetCookie()]) {
    headers.append("set-cookie", sc);
  }
  return new Response(null, { status: 302, headers });
});

// Dance → app. The provider callback landed and Auth.js set its (JWT) session
// cookie on OUR origin; read it back, mint a single-use code, and send the
// browser to the app. The cookie has now served its whole purpose — the code
// is what crosses to the client.
auth.get("/complete", async (c) => {
  const returnTo = validReturn(c.req.query("return"));
  if (!returnTo) return c.json({ error: "return must be a URL on an allowed app origin" }, 400);

  const origin = new URL(c.req.url).origin;
  const sessionRes = await Auth(
    new Request(`${origin}/v1/auth/session`, { headers: { cookie: c.req.header("cookie") ?? "" } }),
    buildAuthConfig(),
  );
  const session = (await sessionRes.json()) as Partial<DanceSession> | null;
  if (!session?.playerId || !session.provider || !session.providerAccountId) {
    return c.json({ error: "no completed sign-in to redeem — the OAuth dance did not finish" }, 401);
  }

  await prisma.loginCode.deleteMany({ where: { expiresAt: { lte: new Date() } } }); // opportunistic sweep
  const code = newLoginCode();
  await prisma.loginCode.create({
    data: {
      codeHash: sha256(code),
      playerId: session.playerId,
      provider: session.provider,
      providerAccountId: session.providerAccountId,
      expiresAt: new Date(Date.now() + LOGIN_CODE_TTL_MS),
    },
  });
  const url = new URL(returnTo);
  url.searchParams.set("code", code);
  return c.redirect(url.toString(), 302);
});

// Code → bearer token. Guest adoption happens HERE, atomically with sign-in:
//  - the account's player has no saves → the account (and any of its sessions)
//    re-points to the guest's player, so every save the guest pushed simply
//    gains an account — zero data movement;
//  - the account's player HAS saves (returning player, new device) → nothing is
//    touched or overwritten; the client learns via hasServerSave and the
//    restore flow (next slice) resolves it.
// The guest session is revoked either way — the client is replacing it.
auth.post("/token", async (c) => {
  let body: { code?: unknown; guestToken?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "expected a JSON body" }, 400);
  }
  const code = typeof body.code === "string" ? body.code : null;
  const guestToken = typeof body.guestToken === "string" ? body.guestToken : null;
  if (!code) return c.json({ error: "code is required" }, 400);

  // Atomic single-use consume: a replayed or expired code updates zero rows.
  const consumed = await prisma.loginCode.updateMany({
    where: { codeHash: sha256(code), consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });
  if (consumed.count === 0) return c.json({ error: "invalid, expired, or already-used code" }, 400);
  const login = await prisma.loginCode.findUniqueOrThrow({ where: { codeHash: sha256(code) } });

  let playerId = login.playerId;
  let adopted = false;
  if (guestToken) {
    const guestPlayerId = await resolveSession(guestToken);
    if (guestPlayerId && guestPlayerId !== playerId) {
      const accountSlots = await prisma.saveSlot.count({ where: { playerId } });
      if (accountSlots === 0) {
        await prisma.$transaction([
          prisma.authAccount.updateMany({ where: { playerId }, data: { playerId: guestPlayerId } }),
          prisma.apiSession.updateMany({ where: { playerId }, data: { playerId: guestPlayerId } }),
          prisma.player.delete({ where: { id: playerId } }), // now empty; cascades stray codes
        ]);
        playerId = guestPlayerId;
        adopted = true;
      }
    }
    await revokeSession(guestToken);
  }

  const hasServerSave =
    !adopted && (await prisma.saveSlot.count({ where: { playerId } })) > 0;
  const account = await prisma.authAccount.findUniqueOrThrow({
    where: {
      provider_providerAccountId: {
        provider: login.provider,
        providerAccountId: login.providerAccountId,
      },
    },
    select: { provider: true, displayName: true, email: true },
  });
  const token = await mintSession(playerId);
  return c.json({ token, account, hasServerSave });
});

// Sign-out: revoke the presented token. Idempotent — an already-dead token
// signs out to the same place.
auth.delete("/session", async (c) => {
  const header = c.req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (token) await revokeSession(token);
  return c.json({ ok: true });
});

// Everything else under /v1/auth/* IS Auth.js: /signin, /callback/:provider,
// /csrf, /session, /error … Registered last so the bookends above win.
auth.all("/*", (c) => Auth(c.req.raw, buildAuthConfig()));
