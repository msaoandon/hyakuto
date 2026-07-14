import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { OAuth2Server, Events } from "oauth2-mock-server";
import { createApp } from "../src/app";
import { prisma } from "../src/db";
import { CookieJar } from "./helpers";

// The FULL browser-facing dance, end to end, against a real (mock) OIDC
// provider — no piece of it is stubbed. Everything under test is exactly what
// a real browser does: follow the redirect our /start hands back, land on the
// provider, follow ITS redirect to our /callback, follow OUR redirect to
// /complete, then read the ?code= it hands to the app and exchange it.
// oauth2-mock-server is a real HTTP server with real JWKs — @auth/core's OIDC
// discovery, PKCE, nonce, and signature verification all run for real.

const APP_ORIGIN = "http://localhost:3000";
const RETURN_URL = `${APP_ORIGIN}/auth/return`;

let mock: OAuth2Server;
let issuerUrl: string;
const app = createApp();

beforeAll(async () => {
  await prisma.player.deleteMany();
  mock = new OAuth2Server();
  await mock.issuer.keys.generate("RS256");
  await mock.start(0, "localhost");
  issuerUrl = mock.issuer.url!;
  // The mock always authenticates as "johndoe" (its /authorize endpoint has no
  // real login step) — give that identity an email/name so the profile mapping
  // is exercised, same as it would be against Google/Discord.
  mock.service.on(Events.BeforeTokenSigning, (token) => {
    Object.assign(token.payload, { email: "johndoe@example.com", name: "John Doe" });
  });
});

afterAll(async () => {
  await mock.stop();
});

/** Drive one `app.request` hop and, if it 302s, feed the jar. */
async function hop(url: string, jar: CookieJar): Promise<Response> {
  const res = await app.request(url, { headers: jar.header() ? { cookie: jar.header() } : {} });
  jar.collect(res);
  return res;
}

function location(res: Response): string {
  const loc = res.headers.get("location");
  if (!loc) throw new Error(`expected a redirect, got ${res.status}`);
  return loc;
}

/** The provider hop is a REAL network request — the mock server is a real
 *  process listening on a real port, unlike our app (driven in-memory). */
async function hopProvider(url: string, jar: CookieJar): Promise<Response> {
  const res = await fetch(url, { headers: jar.header() ? { cookie: jar.header() } : {}, redirect: "manual" });
  jar.collect(res);
  return res;
}

/** path+query only — app.request needs a same-origin target, the mock's
 *  redirect back to us is an absolute http://localhost:3100/... URL. */
function pathOf(absoluteUrl: string): string {
  const u = new URL(absoluteUrl);
  return u.pathname + u.search;
}

describe("the full OAuth dance", () => {
  it("start → provider → callback → complete → token exchange, using a real OIDC server", async () => {
    process.env.AUTH_TEST_ISSUER = issuerUrl;
    const jar = new CookieJar();

    // 1) App → our /start (server-side CSRF handshake, redirects to the provider).
    const start = await hop(`/v1/auth/start/test?return=${encodeURIComponent(RETURN_URL)}`, jar);
    expect(start.status).toBe(302);
    const authorizeUrl = location(start);
    expect(authorizeUrl).toContain(issuerUrl);

    // 2) Provider (real network) → redirects straight back with a code (the
    // mock has no interactive login screen).
    const authorized = await hopProvider(authorizeUrl, jar);
    expect(authorized.status).toBe(302);
    const callbackUrl = location(authorized);
    expect(callbackUrl).toContain("/v1/auth/callback/test");

    // 3) Our /callback: @auth/core exchanges the code with the provider for
    // real (token + userinfo), runs signIn/jwt, sets its session cookie, and
    // redirects to our own /complete.
    const callback = await hop(pathOf(callbackUrl), jar);
    expect(callback.status).toBe(302);
    expect(location(callback)).toContain("/v1/auth/complete");

    // 4) /complete reads that session back and mints a single-use login code,
    // redirecting to the APP (not the provider) with ?code=.
    const complete = await hop(pathOf(location(callback)), jar);
    expect(complete.status).toBe(302);
    const returnUrl = new URL(location(complete));
    expect(returnUrl.origin).toBe(APP_ORIGIN);
    const code = returnUrl.searchParams.get("code");
    expect(code).toBeTruthy();

    // 5) The app exchanges the code for a bearer token — no cookies involved
    // from here on, exactly like a Capacitor client would do it.
    const tokenRes = await app.request("/v1/auth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    expect(tokenRes.status).toBe(200);
    const { token, account } = await tokenRes.json();
    expect(account).toEqual({ provider: "test", displayName: "John Doe", email: "johndoe@example.com" });

    const me = await app.request("/v1/me", { headers: { authorization: `Bearer ${token}` } });
    expect(me.status).toBe(200);
    expect((await me.json()).guest).toBe(false);

    // The code is single-use: replaying it must fail even though the dance succeeded.
    const replay = await app.request("/v1/auth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    expect(replay.status).toBe(400);
  });

  it("a second dance for the same external identity signs back into the same player", async () => {
    process.env.AUTH_TEST_ISSUER = issuerUrl;
    const jar = new CookieJar();
    const start = await hop(`/v1/auth/start/test?return=${encodeURIComponent(RETURN_URL)}`, jar);
    const authorized = await hopProvider(location(start), jar);
    const callback = await hop(pathOf(location(authorized)), jar);
    const complete = await hop(pathOf(location(callback)), jar);
    const code = new URL(location(complete)).searchParams.get("code");

    const res = await app.request("/v1/auth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const { account } = await res.json();
    expect(account.email).toBe("johndoe@example.com");
    expect(await prisma.authAccount.count({ where: { provider: "test", providerAccountId: "johndoe" } })).toBe(1);
  });
});
