import { z } from 'zod';
import { DayConfig } from './day';
import { Localized } from '../i18n/localized';

// ─── MANIFEST CONTRACT ───────────────────────────────────
// Zod schemas for the shapes emitted by the Apps Script exporter
// (see .claude/AppsScript.md). These are the single source of truth: the TS
// types are inferred below, so the schema and the type can never drift.
//
// Scope: shape only. This is the load-boundary parse, not the content audit —
// no cross-references (segment↔block, thread resolution) and no value semantics
// (HH:MM well-formedness, unlock_after ordering). Those live in @hyakuto/content.

/** Per-segment envelope from the `_manifest` tab. */
export const SegmentMeta = z.object({
  id: z.string().min(1),
  type: z.enum(['group_chat', 'dm', 'vn', 'system']),
  route: z.string().optional(),
  day: z.number().int().positive().optional(),
  thread_id: z.string().optional(),
  scene: z.string().optional(),
  condition: z.string().optional(),
});

/** Per-thread (chat) envelope from the `_threads` tab. */
export const ThreadMeta = z.object({
  display_name: Localized,
  condition: z.string().optional(),
  ost: z.string().optional(),
  /** Wall-clock time-of-day ("HH:MM") before which the chat stays locked. */
  unlock_after: z.string().optional(),
  /** Explicit prerequisite chat; defaults to the previous chat in day order. */
  requires: z.string().optional(),
  /** For a DM thread: the contact's character ID (drives the inbox avatar). */
  contact: z.string().optional(),
});

export const Manifest = z.object({
  days: z.array(DayConfig).min(1),
  segments: z.record(z.string(), SegmentMeta),
  threads: z.record(z.string(), ThreadMeta),
});

export type SegmentMeta = z.infer<typeof SegmentMeta>;
export type ThreadMeta = z.infer<typeof ThreadMeta>;
export type Manifest = z.infer<typeof Manifest>;

/**
 * Validate untrusted JSON into a Manifest at the load boundary. Throws loudly
 * with a clear message on the first shape violation — fail fast, never play a
 * malformed manifest. Shared by the web app (build-time, on the bundled JSON)
 * and the CLI.
 */
export function parseManifest(data: unknown): Manifest {
  const result = Manifest.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue.path.length ? ` at ${issue.path.join('.')}` : '';
    throw new Error(`Invalid manifest${where}: ${issue.message}`);
  }
  return result.data;
}
