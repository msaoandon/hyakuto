import { describe, it, expect, beforeAll } from "vitest";
import { PLAYER_SAVE_VERSION, type PlayerSaveT } from "@hyakuto/player-save";
import { createApp } from "../src/app";
import { prisma } from "../src/db";
import { newLoginCode, sha256, LOGIN_CODE_TTL_MS } from "../src/auth/tokens";
import { newGuest, authed } from "./helpers";

// The token layer WITHOUT the OAuth dance: login codes are seeded straight into
// the DB (exactly what /complete writes), so exchange/adoption/revocation logic
// is tested in isolation. The dance itself is covered in oauth-dance.test.ts.

const app = createApp();

const save = (candles: number): PlayerSaveT => ({
  schemaVersion: PLAYER_SAVE_VERSION,
  save: { axes: {}, counters: { candles }, flags: [], poolSelections: {}, gender: "unset", choices: {} },
  mc: { name: "", pronouns: "they" },
  mcChosen: true,
  completed: {},
  dmRead: {},
});

const putSave = (token: string, body: PlayerSaveT) =>
  app.request("/v1/me/slots/0", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...authed(token) },
  });

const whoami = async (token: string) => {
  const res = await app.request("/v1/me", { headers: authed(token) });
  return { status: res.status, body: res.status === 200 ? await res.json() : null };
};

/** Seed what a completed OAuth dance leaves behind: a player, a linked account,
 *  and a fresh login code. */
async function seedLogin(providerAccountId: string, opts: { expired?: boolean } = {}) {
  const account = await prisma.authAccount.create({
    data: {
      provider: "test",
      providerAccountId,
      displayName: "Yuki",
      email: null, // the Apple-relay posture: never assume an email
      player: { create: {} },
    },
  });
  const code = newLoginCode();
  await prisma.loginCode.create({
    data: {
      codeHash: sha256(code),
      playerId: account.playerId,
      provider: "test",
      providerAccountId,
      expiresAt: new Date(Date.now() + (opts.expired ? -1000 : LOGIN_CODE_TTL_MS)),
    },
  });
  return { code, playerId: account.playerId };
}

const exchange = (body: unknown) =>
  app.request("/v1/auth/token", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

beforeAll(async () => {
  await prisma.player.deleteMany();
});

describe("bearer sessions", () => {
  it("401s without a token, with a garbage token, and with a wrong scheme", async () => {
    expect((await app.request("/v1/me")).status).toBe(401);
    expect((await app.request("/v1/me", { headers: authed("hyk_nope") })).status).toBe(401);
    expect((await app.request("/v1/me", { headers: { authorization: "Basic abc" } })).status).toBe(401);
  });

  it("a guest token authenticates and reads back as a guest", async () => {
    const token = await newGuest(app);
    const { status, body } = await whoami(token);
    expect(status).toBe(200);
    expect(body.guest).toBe(true);
    expect(body.accounts).toEqual([]);
  });

  it("an expired session 401s and is deleted on sight", async () => {
    await prisma.apiSession.deleteMany();
    const token = await newGuest(app);
    await prisma.apiSession.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await whoami(token)).status).toBe(401);
    expect(await prisma.apiSession.count()).toBe(0);
  });

  it("sign-out revokes the token; a second sign-out is a harmless no-op", async () => {
    const token = await newGuest(app);
    const signOut = () =>
      app.request("/v1/auth/session", { method: "DELETE", headers: authed(token) });
    expect((await signOut()).status).toBe(200);
    expect((await whoami(token)).status).toBe(401);
    expect((await signOut()).status).toBe(200);
  });
});

describe("login-code exchange", () => {
  it("a code becomes a working token carrying the account identity", async () => {
    const { code } = await seedLogin("acct-plain");
    const res = await exchange({ code });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.account).toEqual({ provider: "test", displayName: "Yuki", email: null });
    expect(body.hasServerSave).toBe(false);
    const { body: meBody } = await whoami(body.token);
    expect(meBody.guest).toBe(false);
    expect(meBody.accounts).toEqual([{ provider: "test", displayName: "Yuki", email: null }]);
  });

  it("a code is single-use and expiry is enforced", async () => {
    const { code } = await seedLogin("acct-reuse");
    expect((await exchange({ code })).status).toBe(200);
    expect((await exchange({ code })).status).toBe(400); // replay
    const { code: stale } = await seedLogin("acct-stale", { expired: true });
    expect((await exchange({ code: stale })).status).toBe(400);
    expect((await exchange({ code: "garbage" })).status).toBe(400);
    expect((await exchange({})).status).toBe(400);
  });

  it("a first sign-in adopts the guest's player: saves survive, identities merge", async () => {
    const guestToken = await newGuest(app);
    await putSave(guestToken, save(77));
    const { code, playerId: freshAccountPlayer } = await seedLogin("acct-adopts");

    const res = await exchange({ code, guestToken });
    const body = await res.json();
    expect(body.hasServerSave).toBe(false); // the server copy IS the client's own pushes

    // The account token addresses the guest's data.
    const slot = await app.request("/v1/me/slots/0", { headers: authed(body.token) });
    expect(((await slot.json()) as PlayerSaveT).save.counters.candles).toBe(77);
    const { body: meBody } = await whoami(body.token);
    expect(meBody.guest).toBe(false);

    // The fresh, empty account player is gone; the guest token is revoked.
    expect(await prisma.player.findUnique({ where: { id: freshAccountPlayer } })).toBeNull();
    expect((await whoami(guestToken)).status).toBe(401);
  });

  it("an existing account with saves is never overwritten by a guest sign-in", async () => {
    // A returning player: their account already has a server save (95 candles).
    const { code: firstCode, playerId: accountPlayer } = await seedLogin("acct-returning");
    const firstToken = (await (await exchange({ code: firstCode })).json()).token;
    await putSave(firstToken, save(95));

    // New device: fresh guest with local progress signs into that account.
    const guestToken = await newGuest(app);
    await putSave(guestToken, save(12));
    const code2 = newLoginCode();
    await prisma.loginCode.create({
      data: {
        codeHash: sha256(code2),
        playerId: accountPlayer,
        provider: "test",
        providerAccountId: "acct-returning",
        expiresAt: new Date(Date.now() + LOGIN_CODE_TTL_MS),
      },
    });
    const body = await (await exchange({ code: code2, guestToken })).json();

    expect(body.hasServerSave).toBe(true); // restore flow's signal — nothing auto-merged
    const slot = await app.request("/v1/me/slots/0", { headers: authed(body.token) });
    expect(((await slot.json()) as PlayerSaveT).save.counters.candles).toBe(95); // account save intact
    expect((await whoami(guestToken)).status).toBe(401); // guest session replaced
  });

  it("account deletion cascades accounts, sessions, and codes (GDPR)", async () => {
    const { code } = await seedLogin("acct-gdpr");
    const token = (await (await exchange({ code })).json()).token;
    await putSave(token, save(50));
    expect((await app.request("/v1/me", { method: "DELETE", headers: authed(token) })).status).toBe(200);
    expect((await whoami(token)).status).toBe(401);
    expect(await prisma.authAccount.count({ where: { providerAccountId: "acct-gdpr" } })).toBe(0);
  });
});

describe("dance bookends (validation only — the dance itself is oauth-dance.test.ts)", () => {
  it("/start rejects a return target off the app-origin allow-list", async () => {
    const bad = await app.request(
      `/v1/auth/start/test?return=${encodeURIComponent("https://evil.example/steal")}`,
    );
    expect(bad.status).toBe(400);
    expect((await app.request("/v1/auth/start/test")).status).toBe(400); // missing
  });

  it("/start rejects an unconfigured provider", async () => {
    // "apple" specifically — deferred and never wired into providers() at all,
    // so this holds regardless of ambient env (unlike google/discord, whose
    // configured-ness depends on a developer's local .env — see the "test"
    // provider check above for why we don't assert on those here).
    const res = await app.request(
      `/v1/auth/start/apple?return=${encodeURIComponent("http://localhost:3000/auth/return")}`,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not configured/);
  });

  it("/complete without a finished dance is a 401, not a code", async () => {
    const res = await app.request(
      `/v1/auth/complete?return=${encodeURIComponent("http://localhost:3000/auth/return")}`,
    );
    expect(res.status).toBe(401);
  });
});
