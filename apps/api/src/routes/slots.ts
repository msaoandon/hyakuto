import { Hono } from "hono";
import { migratePlayerSave } from "@hyakuto/player-save";
import { prisma } from "../db";
import { toRows, toPayload } from "../serialize";

// Save-slot CRUD (v1, pre-auth). Identity is a client-generated player id — the
// documented Phase-3 shortcut; the auth slice replaces it with the session's
// player. Writes are transactional full-slot replaces: a slot is never half-new.

export const slots = new Hono();

const SLOT_INCLUDE = { axes: true, counters: true, flags: true, choices: true, completions: true } as const;

function parseSlot(param: string): number | null {
  const n = Number(param);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

slots.put("/players/:playerId/slots/:slot", async (c) => {
  const playerId = c.req.param("playerId");
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
    await tx.player.upsert({ where: { id: playerId }, create: { id: playerId }, update: {} });
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

slots.get("/players/:playerId/slots/:slot", async (c) => {
  const playerId = c.req.param("playerId");
  const slot = parseSlot(c.req.param("slot"));
  if (slot === null) return c.json({ error: "slot must be a non-negative integer" }, 400);

  const row = await prisma.saveSlot.findUnique({
    where: { playerId_slot: { playerId, slot } },
    include: SLOT_INCLUDE,
  });
  if (!row) return c.json({ error: "no such slot" }, 404);
  return c.json(toPayload(row));
});

slots.get("/players/:playerId/slots", async (c) => {
  const playerId = c.req.param("playerId");
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

slots.delete("/players/:playerId/slots/:slot", async (c) => {
  const playerId = c.req.param("playerId");
  const slot = parseSlot(c.req.param("slot"));
  if (slot === null) return c.json({ error: "slot must be a non-negative integer" }, 400);
  await prisma.saveSlot.deleteMany({ where: { playerId, slot } }); // cascade clears children
  return c.json({ ok: true });
});

// GDPR ancestor: everything about a player, gone in one call.
slots.delete("/players/:playerId", async (c) => {
  await prisma.player.deleteMany({ where: { id: c.req.param("playerId") } });
  return c.json({ ok: true });
});
