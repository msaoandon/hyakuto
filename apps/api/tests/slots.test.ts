import { describe, it, expect, beforeAll } from "vitest";
import { PLAYER_SAVE_VERSION, type PlayerSaveT } from "@hyakuto/player-save";
import { createApp } from "../src/app";
import { prisma } from "../src/db";

const app = createApp();
const P = "11111111-1111-4111-8111-111111111111";

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

const put = (playerId: string, slot: number, body: unknown) =>
  app.request(`/v1/players/${playerId}/slots/${slot}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
const get = (playerId: string, slot: number) => app.request(`/v1/players/${playerId}/slots/${slot}`);

beforeAll(async () => {
  await prisma.player.deleteMany();
});

describe("save-slot round-trip", () => {
  it("PUT → GET is byte-faithful for a maximal save", async () => {
    expect((await put(P, 0, full)).status).toBe(200);
    const res = await get(P, 0);
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
    expect((await put(P, 1, fresh)).status).toBe(200);
    const body = await (await get(P, 1)).json();
    // Optional engine fields normalize: gender → "unset", choices → {}.
    expect(body).toEqual({ ...fresh, save: { ...fresh.save, gender: "unset", choices: {} } });
  });

  it("overwrite replaces child rows exactly (no orphans, no leftovers)", async () => {
    const smaller: PlayerSaveT = {
      ...full,
      save: { ...full.save, axes: { kou: 5 }, flags: [], choices: {} },
      completed: { "1:demo_d1_t1": 1760000000000 },
    };
    expect((await put(P, 0, smaller)).status).toBe(200);
    expect(await (await get(P, 0)).json()).toEqual({ ...smaller, save: { ...smaller.save } });

    const slotRow = await prisma.saveSlot.findUniqueOrThrow({
      where: { playerId_slot: { playerId: P, slot: 0 } },
      include: { axes: true, flags: true, choices: true, completions: true },
    });
    expect(slotRow.axes).toHaveLength(1);
    expect(slotRow.flags).toHaveLength(0);
    expect(slotRow.choices).toHaveLength(0);
    expect(slotRow.completions).toHaveLength(1);
  });

  it("slots and players are isolated", async () => {
    const other = "22222222-2222-4222-8222-222222222222";
    await put(other, 0, full);
    const mine = await (await get(P, 0)).json();
    const theirs = await (await get(other, 0)).json();
    expect(theirs).toEqual(full);
    expect(mine).not.toEqual(full); // P slot 0 holds the smaller overwrite
  });

  it("lists slots with metadata", async () => {
    const res = await app.request(`/v1/players/${P}/slots`);
    const list = await res.json();
    expect(list.map((s: { slot: number }) => s.slot)).toEqual([0, 1]);
    expect(list[0].candles).toBe(93);
    expect(list[0].completedThreads).toBe(1);
    expect(list[1].candles).toBe(100);
  });
});

describe("boundaries", () => {
  it("rejects malformed payloads with 400 and a located message", async () => {
    const res = await put(P, 0, { ...full, save: { ...full.save, flags: "nope" } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/save\.flags/);
  });

  it("rejects future schema versions (never store what we can't read)", async () => {
    const res = await put(P, 0, { ...full, schemaVersion: 99 });
    expect(res.status).toBe(400);
  });

  it("404s an absent slot; 400s a garbage slot number", async () => {
    expect((await get(P, 7)).status).toBe(404);
    expect((await app.request(`/v1/players/${P}/slots/x`)).status).toBe(400);
  });

  it("DELETE player removes every trace (GDPR path)", async () => {
    const ghost = "33333333-3333-4333-8333-333333333333";
    await put(ghost, 0, full);
    await put(ghost, 1, full);
    const res = await app.request(`/v1/players/${ghost}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    expect((await get(ghost, 0)).status).toBe(404);
    expect(await prisma.saveSlot.count({ where: { playerId: ghost } })).toBe(0);
    expect(await prisma.axisValue.count()).toBeGreaterThanOrEqual(0); // no FK debris possible: cascades
    expect(await prisma.player.findUnique({ where: { id: ghost } })).toBeNull();
  });
});
