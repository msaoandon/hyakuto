import { Hono } from "hono";
import { migratePlayerSave } from "@hyakuto/player-save";
import { prisma } from "../db";
import { toRows, toPayload } from "../serialize";
import { requireSession, type AuthedEnv } from "../auth/middleware";

// The player's own data, addressed as /me — the playerId comes from the bearer
// session (set by requireSession in app.ts), never from the URL, so requesting
// someone else's save is not a case to reject: it cannot be expressed.
// Writes are transactional full-slot replaces: a slot is never half-new.

export const me = new Hono<AuthedEnv>();
me.use("*", requireSession); // no route below exists without a session

const SLOT_INCLUDE = { axes: true, counters: true, flags: true, choices: true, completions: true } as const;

function parseSlot(param: string): number | null {
  const n = Number(param);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Who am I — token check + account state for the Settings UI. */
me.get("/", async (c) => {
  const playerId = c.get("playerId");
  const accounts = await prisma.authAccount.findMany({
    where: { playerId },
    orderBy: { createdAt: "asc" },
    select: { provider: true, displayName: true, email: true },
  });
  return c.json({ playerId, guest: accounts.length === 0, accounts });
});

me.put("/slots/:slot", async (c) => {
  const playerId = c.get("playerId");
  const slot = parseSlot(c.req.param("slot"));
  if (slot === null) return c.json({ error: "slot must be a non-negative integer" }, 400);

  let payload;
  try {
    payload = migratePlayerSave(await c.req.json());
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }

  const rows = toRows(payload);
  await prisma.$transaction(async (tx) => {
    const slotRow = await tx.saveSlot.upsert({
      where: { playerId_slot: { playerId, slot } },
      create: { ...rows.scalar, playerId, slot },
      update: rows.scalar,
    });
    const slotId = slotRow.id;
    await tx.axisValue.deleteMany({ where: { slotId } });
    await tx.counterValue.deleteMany({ where: { slotId } });
    await tx.flagSet.deleteMany({ where: { slotId } });
    await tx.choiceRecord.deleteMany({ where: { slotId } });
    await tx.completion.deleteMany({ where: { slotId } });
    await tx.axisValue.createMany({ data: rows.axes.map((r) => ({ ...r, slotId })) });
    await tx.counterValue.createMany({ data: rows.counters.map((r) => ({ ...r, slotId })) });
    await tx.flagSet.createMany({ data: rows.flags.map((r) => ({ ...r, slotId })) });
    await tx.choiceRecord.createMany({ data: rows.choices.map((r) => ({ ...r, slotId })) });
    await tx.completion.createMany({ data: rows.completions.map((r) => ({ ...r, slotId })) });
  });
  return c.json({ ok: true });
});

me.get("/slots/:slot", async (c) => {
  const playerId = c.get("playerId");
  const slot = parseSlot(c.req.param("slot"));
  if (slot === null) return c.json({ error: "slot must be a non-negative integer" }, 400);

  const row = await prisma.saveSlot.findUnique({
    where: { playerId_slot: { playerId, slot } },
    include: SLOT_INCLUDE,
  });
  if (!row) return c.json({ error: "no such slot" }, 404);
  return c.json(toPayload(row));
});

me.get("/slots", async (c) => {
  const playerId = c.get("playerId");
  const rows = await prisma.saveSlot.findMany({
    where: { playerId },
    orderBy: { slot: "asc" },
    include: { counters: { where: { counter: "candles" } }, _count: { select: { completions: true } } },
  });
  return c.json(
    rows.map((r) => ({
      slot: r.slot,
      updatedAt: r.updatedAt.toISOString(),
      candles: r.counters[0]?.value ?? null,
      completedThreads: r._count.completions,
    })),
  );
});

me.delete("/slots/:slot", async (c) => {
  const playerId = c.get("playerId");
  const slot = parseSlot(c.req.param("slot"));
  if (slot === null) return c.json({ error: "slot must be a non-negative integer" }, 400);
  await prisma.saveSlot.deleteMany({ where: { playerId, slot } }); // cascade clears children
  return c.json({ ok: true });
});

// GDPR: everything about the player — saves, linked accounts, sessions (this
// one included) — gone in one call, via cascades. Built now, not retrofitted.
me.delete("/", async (c) => {
  await prisma.player.deleteMany({ where: { id: c.get("playerId") } });
  return c.json({ ok: true });
});
