import { z } from 'zod';
import { TranslatableUnit, LocaleCode } from './translatable';
import { WorldConfig } from './world';

// ─── CONTENT MODEL ────────────────────────────────────────────────────────────
// Normalized, id-keyed entities. Sequence is carried by array order (lossless in
// the file store; a DB store adds an `order` column behind the ProjectStore seam)
// while every *cross-entity* reference is by stable id, never by position — the
// single discipline that made Sheets fail (§III.1/2). The tree mirrors the
// engine's Block/Manifest/GameConfig contracts so `compile()` is a mechanical
// projection, but it is authored against ids and *relationships*, not JSON.

/** An effect on an axis or counter. `target` is an id into world.axes ∪ counters
 *  (the engine routes axis vs counter); compiles to the engine's `{ axis, delta }`. */
export const EffectRef = z.object({
  target: z.string().min(1),
  delta: z.number().int(),
});

/** A branch *relationship* (§III + the branching decision): "show this when, in an
 *  earlier choice, MC picked this option." References choice + option by **stable
 *  id**, never by position. Compiles to a `choice:<choiceId>==<optionId>` predicate
 *  — so authors express branching as a link, never by typing a condition. */
export const BranchRef = z.object({
  choiceId: z.string().min(1),
  optionId: z.string().min(1),
});

// Gating shared by every line type the engine lets carry a condition. `condition`
// is a freeform predicate (thresholds, flags, time); `branch` is the structured
// choice relationship. compile() ANDs them into the item's single `condition`.
const gate = {
  condition: z.string().optional(),
  branch: BranchRef.optional(),
} as const;

const StatusLine = z.object({ type: z.literal('status'), id: z.string().min(1), text: TranslatableUnit, ...gate });

const MessageLine = z.object({
  type: z.literal('message'),
  id: z.string().min(1),
  character: z.string().min(1),
  text: TranslatableUnit,
  effects: z.array(EffectRef).optional(),
  /** Story flag set when this line shows (a declared world flag). */
  set_flag: z.string().min(1).optional(),
  ...gate,
});

const StickerLine = z.object({
  type: z.literal('sticker'),
  id: z.string().min(1),
  character: z.string().min(1),
  file: z.string().min(1),
  effects: z.array(EffectRef).optional(),
  ...gate,
});

const ImageLine = z.object({
  type: z.literal('image'),
  id: z.string().min(1),
  character: z.string().min(1),
  file: z.string().min(1),
  effects: z.array(EffectRef).optional(),
  ...gate,
});

const PoolVariant = z.object({
  id: z.string().min(1),
  text: TranslatableUnit,
  weight: z.number().positive().default(1),
});

const PoolLine = z.object({
  type: z.literal('pool'),
  id: z.string().min(1),
  character: z.string().min(1),
  variants: z.array(PoolVariant).min(1),
  effects: z.array(EffectRef).optional(),
  ...gate,
});

// A choice option owns a stable id — this is exactly what a `choice:` branch
// references. Options gate individually (condition/branch) and carry effects; the
// engine's choice item itself has no condition, so the choice line does not gate.
// `set_flag` is the writer-named consequence ("remember this pick as…") — the
// flag-first authoring surface; the recorded choice id remains underneath for
// replay/backends.
const ChoiceOption = z.object({
  id: z.string().min(1),
  text: TranslatableUnit,
  effects: z.array(EffectRef).optional(),
  condition: z.string().optional(),
  branch: BranchRef.optional(),
  set_flag: z.string().min(1).optional(),
});

const ChoiceLine = z.object({
  type: z.literal('choice'),
  id: z.string().min(1),
  character: z.string().min(1).optional(), // absent = MC
  options: z.array(ChoiceOption).min(1),
});

const CueLine = z.object({
  type: z.literal('cue'),
  id: z.string().min(1),
  channel: z.string().min(1),
  value: z.string(),
  ...gate,
});

const TypingLine = z.object({
  type: z.literal('typing'),
  id: z.string().min(1),
  character: z.string().min(1),
});

export const Line = z.discriminatedUnion('type', [
  StatusLine, MessageLine, StickerLine, ImageLine, PoolLine, ChoiceLine, CueLine, TypingLine,
]);

export const ThreadKind = z.enum(['group_chat', 'dm', 'vn']);

/** A thread groups segments and owns their shared presentation. Crucially, the
 *  thread's `kind` is the *single source of a segment's type* (see Segment): a
 *  thread cannot mix chat and VN segments because its segments don't declare a
 *  type at all — making the "thread mixes types" bug unrepresentable. */
export const Thread = z.object({
  id: z.string().min(1),
  kind: ThreadKind,
  display_name: TranslatableUnit,
  condition: z.string().optional(),
  ost: z.string().optional(),
  /** DM contact's character id (drives the inbox avatar); group/VN threads omit it. */
  contact: z.string().optional(),
  /** Wall-clock "HH:MM" before which a chat thread stays locked. */
  unlock_after: z.string().optional(),
  /** Explicit prerequisite thread; defaults to the previous thread in day order. */
  requires: z.string().optional(),
});

/** A playable unit. It has **no** `type` field: its render kind is derived from
 *  its thread's `kind`, and a segment with no thread is a `system` segment. This
 *  is the "illegal states unrepresentable" move — type can never drift from the
 *  thread, and a thread is structurally single-kind. Gates like a line: freeform
 *  `condition` AND/or a structured `branch`, compiled into the manifest gate. */
export const Segment = z.object({
  id: z.string().min(1),
  threadId: z.string().optional(),
  scene: z.string().optional(),
  condition: z.string().optional(),
  branch: BranchRef.optional(),
  lines: z.array(Line).default([]),
});

/** An ordered day on a route. Owns its segment order by id (matches the manifest's
 *  `days[].segments`); segments derive their day/route from membership here. */
export const Day = z.object({
  id: z.string().min(1),
  index: z.number().int().positive(),
  route: z.string().min(1),
  segmentIds: z.array(z.string().min(1)).default([]),
});

/** The workspace / game dimension (§III.3). One game shows now; the schema already
 *  scopes everything under a workspace so multi-tenant later is a UI/store change,
 *  not a data migration. Carries the locale set the translatable units live in. */
export const Workspace = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  defaultLocale: LocaleCode.default('en'),
  locales: z.array(LocaleCode).min(1).default(['en']),
});

// The version the code writes today. Bump + add a migration step (below) whenever
// the shape changes, so old backups still restore (§III.6).
export const CURRENT_SCHEMA_VERSION = 1;

export const Project = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  workspace: Workspace,
  world: WorldConfig,
  threads: z.array(Thread).default([]),
  days: z.array(Day).default([]),
  segments: z.array(Segment).default([]),
});

export type EffectRef = z.infer<typeof EffectRef>;
export type BranchRef = z.infer<typeof BranchRef>;
export type Line = z.infer<typeof Line>;
export type ThreadKind = z.infer<typeof ThreadKind>;
export type Thread = z.infer<typeof Thread>;
export type Segment = z.infer<typeof Segment>;
export type Day = z.infer<typeof Day>;
export type Workspace = z.infer<typeof Workspace>;
export type Project = z.infer<typeof Project>;

// ─── MIGRATION SEAM (§III.6) ──────────────────────────────────────────────────
// Same discipline as the Zustand persist `migrate`: stored data carries its
// `schemaVersion`; on load we step it up to CURRENT before validating. v1 is the
// baseline (no prior steps). This exists now, empty, so the *seam* is in place —
// when the model evolves, add `MIGRATIONS[n]` and old backups keep restoring.
type Migration = (data: Record<string, unknown>) => Record<string, unknown>;
const MIGRATIONS: Record<number, Migration> = {
  // 1: (data) => ({ ...data, schemaVersion: 2, /* … */ }),
};

/**
 * Parse untrusted project JSON into a validated `Project`, migrating older
 * `schemaVersion`s forward first. Throws loudly with a located message on the
 * first shape violation — never load a malformed project.
 */
export function migrateProject(raw: unknown): Project {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid project: expected an object');
  let data = raw as Record<string, unknown>;
  let version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;

  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`No migration path from schemaVersion ${version} to ${CURRENT_SCHEMA_VERSION}`);
    data = step(data);
    version = data.schemaVersion as number;
  }
  if (version > CURRENT_SCHEMA_VERSION)
    throw new Error(`Project schemaVersion ${version} is newer than supported ${CURRENT_SCHEMA_VERSION}`);

  const parsed = Project.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue.path.length ? ` at ${issue.path.join('.')}` : '';
    throw new Error(`Invalid project${where}: ${issue.message}`);
  }
  return parsed.data;
}
