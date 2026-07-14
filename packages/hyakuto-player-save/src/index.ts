import { z } from 'zod';
import type { SaveState } from '@hyakuto/engine';

// ─── THE PLAYER-SAVE CONTRACT ─────────────────────────────────────────────────
// The payload the web app pushes to apps/api and (Phase 4) migrates into
// Supabase. Shared as a package so both sides validate the SAME schema — a
// drifted payload fails loudly at whichever boundary sees it first.
//
// Deliberately NOT in the contract:
//  - device prefs (locale, music, pace): device state, not playthrough state;
//  - the avatar: object storage in Phase 4, never a database row/blob.

export const PLAYER_SAVE_VERSION = 1;

/** Mirror of the engine's SaveState. The engine owns the TypeScript shape; the
 *  parity checks below make any drift a compile error in this package. */
export const EngineSave = z.object({
  axes: z.record(z.string(), z.number()),
  counters: z.record(z.string(), z.number()),
  flags: z.array(z.string()),
  poolSelections: z.record(z.string(), z.number()),
  gender: z.enum(['male', 'female', 'unset']).optional(),
  choices: z.record(z.string(), z.string()).optional(),
});
export type EngineSaveT = z.infer<typeof EngineSave>;

// Two-way parity with @hyakuto/engine's SaveState — drift fails compilation.
const _toEngine = (s: EngineSaveT): SaveState => s;
const _fromEngine = (s: SaveState): EngineSaveT => s;
void _toEngine;
void _fromEngine;

export const McProfile = z.object({
  name: z.string(),
  pronouns: z.enum(['they', 'she', 'he']),
});

export const PlayerSave = z.object({
  schemaVersion: z.literal(PLAYER_SAVE_VERSION),
  save: EngineSave,
  /** Opaque on the server (GDPR posture) — stored as one blob, never columns. */
  mc: McProfile,
  mcChosen: z.boolean(),
  /** Completed thread key (`day:thread_id`) → completion epoch ms. */
  completed: z.record(z.string(), z.number()),
  /** DM read cursor: thread id → seen segment ids. */
  dmRead: z.record(z.string(), z.array(z.string())),
});
export type PlayerSaveT = z.infer<typeof PlayerSave>;

// ─── MIGRATION SEAM ───────────────────────────────────────────────────────────
// Same discipline as the CMS project model: stored payloads carry their
// schemaVersion; readers step them up to CURRENT before validating. v1 is the
// baseline — the seam exists now so old rows keep restoring when the shape grows.
type Migration = (data: Record<string, unknown>) => Record<string, unknown>;
const MIGRATIONS: Record<number, Migration> = {
  // 1: (data) => ({ ...data, schemaVersion: 2, /* … */ }),
};

/** Parse an untrusted payload into a current-version PlayerSave, migrating older
 *  versions forward. Throws loudly with a located message — never accept or
 *  return a malformed save. */
export function migratePlayerSave(raw: unknown): PlayerSaveT {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid player save: expected an object');
  let data = raw as Record<string, unknown>;
  let version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;

  while (version < PLAYER_SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`No migration path from player-save version ${version} to ${PLAYER_SAVE_VERSION}`);
    data = step(data);
    version = data.schemaVersion as number;
  }
  if (version > PLAYER_SAVE_VERSION)
    throw new Error(`Player save version ${version} is newer than supported ${PLAYER_SAVE_VERSION}`);

  const parsed = PlayerSave.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue.path.length ? ` at ${issue.path.join('.')}` : '';
    throw new Error(`Invalid player save${where}: ${issue.message}`);
  }
  return parsed.data;
}
