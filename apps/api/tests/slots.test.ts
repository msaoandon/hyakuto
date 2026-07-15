import { describe, it, expect, beforeAll } from "vitest";
import { PLAYER_SAVE_VERSION, type PlayerSaveT } from "@hyakuto/player-save";
import { createApp } from "../src/app";
import { prisma } from "../src/db";
import { newGuest, authed } from "./helpers";

const app = createApp();

// Maximal: every field populated (the round-trip must be byte-faithful).
const full: PlayerSaveT = {
  schemaVersion: PLAYER_SAVE_VERSION,
  save: {
    axes: { tatsumi: 2, ren: -1, kou: 1 },
    counters: { candles: 93 },
    flags: ["asked_lantern", "met_ren"],
    poolSelections: { demo_d1_s1_pool_4: 1 },
    gender: "female",
    choices: { demo_d1_s2__10: "demo_d1_s2__10__o1" },
  },
  mc: { name: "Юкі", pronouns: "she" },
  mcChosen: true,
  completed: { "1:demo_d1_t1": 1760000000000, "1:demo_d1_t2": 1760000100000 },
  dmRead: { demo_dm1: ["demo_dm1_1"] },
};

const put = (token: string, slot: number | string, body: unknown) =>
  app.request(`/v1/me/slots/${slot}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...authed(token) },
  });
const get = (token: string, slot: number | string) =>
  app.request(`/v1/me/slots/${slot}`, { headers: authed(token) });

let mine: string; // guest bearer tokens — every request is authenticated
let theirs: string;

beforeAll(async () => {
  await prisma.player.deleteMany();
  mine = await newGuest(app);
  theirs = await newGuest(app);
});

describe("save-slot round-trip", () => {
  it("PUT → GET is byte-faithful for a maximal save", async () => {
    expect((await put(mine, 0, full)).status).toBe(200);
    const res = await get(mine, 0);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(full);
  });

  it("a minimal fresh save round-trips to its normalized shape", async () => {
    const fresh = {
      schemaVersion: PLAYER_SAVE_VERSION,
      save: { axes: {}, counters: { candles: 100 }, flags: [], poolSelections: {} },
      mc: { name: "", pronouns: "they" },
      mcChosen: false,
      completed: {},
      dmRead: {},
    };
    expect((await put(mine, 1, fresh)).status).toBe(200);
    const body = await (await get(mine, 1)).json();
    // Optional engine fields normalize: gender → "unset", choices → {}.
    expect(body).toEqual({ ...fresh, save: { ...fresh.save, gender: "unset", choices: {} } });
  });

  it("overwrite replaces child rows exactly (no orphans, no leftovers)", async () => {
    const smaller: PlayerSaveT = {
      ...full,
      save: { ...full.save, axes: { kou: 5 }, flags: [], choices: {} },
      completed: { "1:demo_d1_t1": 1760000000000 },
    };
    expect((await put(mine, 0, smaller)).status).toBe(200);
    expect(await (await get(mine, 0)).json()).toEqual(smaller);

    const { playerId } = (await (
      await app.request("/v1/me", { headers: authed(mine) })
    ).json()) as { playerId: string };
    const slotRow = await prisma.saveSlot.findUniqueOrThrow({
      where: { playerId_slot: { playerId, slot: 0 } },
      include: { axes: true, flags: true, choices: true, completions: true },
    });
    expect(slotRow.axes).toHaveLength(1);
    expect(slotRow.flags).toHaveLength(0);
    expect(slotRow.choices).toHaveLength(0);
    expect(slotRow.completions).toHaveLength(1);
  });

  it("players are isolated: another token never sees my slots", async () => {
    await put(theirs, 0, full);
    const mineBody = await (await get(mine, 0)).json();
    const theirsBody = await (await get(theirs, 0)).json();
    expect(theirsBody).toEqual(full);
    expect(mineBody).not.toEqual(full); // my slot 0 holds the smaller overwrite
  });

  it("lists slots with metadata", async () => {
    const res = await app.request("/v1/me/slots", { headers: authed(mine) });
    const list = await res.json();
    expect(list.map((s: { slot: number }) => s.slot)).toEqual([0, 1]);
    expect(list[0].candles).toBe(93);
    expect(list[0].completedThreads).toBe(1);
    expect(list[1].candles).toBe(100);
  });
});

describe("boundaries", () => {
  it("rejects malformed payloads with 400 and a located message", async () => {
    const res = await put(mine, 0, { ...full, save: { ...full.save, flags: "nope" } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/save\.flags/);
  });

  it("rejects future schema versions (never store what we can't read)", async () => {
    const res = await put(mine, 0, { ...full, schemaVersion: 99 });
    expect(res.status).toBe(400);
  });

  it("404s an absent slot; 400s a garbage slot number", async () => {
    expect((await get(mine, 7)).status).toBe(404);
    expect((await get(mine, "x")).status).toBe(400);
  });

  it("DELETE /me removes every trace, session included (GDPR path)", async () => {
    const ghost = await newGuest(app);
    await put(ghost, 0, full);
    await put(ghost, 1, full);
    const res = await app.request("/v1/me", { method: "DELETE", headers: authed(ghost) });
    expect(res.status).toBe(200);
    // The cascade revoked the session too: the very next call is unauthenticated.
    expect((await get(ghost, 0)).status).toBe(401);
    expect(await prisma.player.count()).toBe(2); // only mine + theirs remain
  });

  it("DELETE /me/slots/:slot removes one save (Saved Games) without touching the others or the session", async () => {
    const saver = await newGuest(app);
    await put(saver, 0, full);
    await put(saver, 1, full);

    const del = await app.request("/v1/me/slots/1", { method: "DELETE", headers: authed(saver) });
    expect(del.status).toBe(200);

    expect((await get(saver, 1)).status).toBe(404); // gone
    expect((await get(saver, 0)).status).toBe(200); // untouched
    expect((await app.request("/v1/me", { headers: authed(saver) })).status).toBe(200); // session still live

    // idempotent: deleting an already-absent slot is not an error
    expect((await app.request("/v1/me/slots/1", { method: "DELETE", headers: authed(saver) })).status).toBe(200);
  });

  it("400s a garbage slot number on delete", async () => {
    expect((await app.request("/v1/me/slots/x", { method: "DELETE", headers: authed(mine) })).status).toBe(400);
  });
});
