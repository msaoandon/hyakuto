import { PLAYER_SAVE_VERSION, migratePlayerSave, type PlayerSaveT } from "@hyakuto/player-save";
import type { Prisma } from "@prisma/client";

// PlayerSave payload ⇄ database rows. Structured tables for everything the
// Phase-4 gating API will query; JSON strings for engine-internal cursors and
// the (deliberately) opaque MC blob. Optional engine fields normalize on the
// way in (gender → "unset", choices → {}): the API always returns the
// normalized, current-version shape.

export function toRows(p: PlayerSaveT) {
  return {
    scalar: {
      schemaVersion: PLAYER_SAVE_VERSION,
      gender: p.save.gender ?? "unset",
      mcBlob: JSON.stringify({ mc: p.mc, mcChosen: p.mcChosen }),
      poolSelections: JSON.stringify(p.save.poolSelections),
      dmRead: JSON.stringify(p.dmRead),
    },
    axes: Object.entries(p.save.axes).map(([axis, value]) => ({ axis, value })),
    counters: Object.entries(p.save.counters).map(([counter, value]) => ({ counter, value })),
    flags: p.save.flags.map((flag) => ({ flag })),
    choices: Object.entries(p.save.choices ?? {}).map(([choiceId, optionId]) => ({ choiceId, optionId })),
    completions: Object.entries(p.completed).map(([threadKey, at]) => ({ threadKey, completedAt: BigInt(at) })),
  };
}

export type SlotWithRelations = Prisma.SaveSlotGetPayload<{
  include: { axes: true; counters: true; flags: true; choices: true; completions: true };
}>;

export function toPayload(slot: SlotWithRelations): PlayerSaveT {
  const mcBlob = JSON.parse(slot.mcBlob) as { mc: unknown; mcChosen: unknown };
  const raw = {
    schemaVersion: slot.schemaVersion,
    save: {
      axes: Object.fromEntries(slot.axes.map((a) => [a.axis, a.value])),
      counters: Object.fromEntries(slot.counters.map((c) => [c.counter, c.value])),
      flags: slot.flags.map((f) => f.flag),
      poolSelections: JSON.parse(slot.poolSelections),
      gender: slot.gender,
      choices: Object.fromEntries(slot.choices.map((c) => [c.choiceId, c.optionId])),
    },
    mc: mcBlob.mc,
    mcChosen: mcBlob.mcChosen,
    completed: Object.fromEntries(slot.completions.map((c) => [c.threadKey, Number(c.completedAt)])),
    dmRead: JSON.parse(slot.dmRead),
  };
  // Rows written by an older server version step up through the migration seam;
  // a row this code can't faithfully return is a loud error, never silent junk.
  return migratePlayerSave(raw);
}
