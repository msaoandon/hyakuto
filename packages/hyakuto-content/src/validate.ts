import { StoryFile, collectConditionRefs } from '@hyakuto/engine';
import type { Block, GameConfig, Manifest } from '@hyakuto/engine';

export type ValidationError = { source: string; segmentId?: string; message: string };
export type ContentSource = { path: string; data: unknown };

/** A JSON source is the manifest (not a block file) if it's the `{ days, segments, threads }` envelope. */
export function isManifest(data: unknown): data is Manifest {
  return (
    !!data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    'days' in data &&
    'segments' in data &&
    'threads' in data
  );
}

const RESERVED = ['MC', 'dev'];
const CUE_CHANNELS = ['music', 'glitch'];

// Parse each file, merge into one pool, catch cross-file id collisions
export function mergeBlocks(sources: ContentSource[]) {
  const pool = new Map<string, { block: Block; source: string }>();
  const errors: ValidationError[] = [];

  for (const src of sources) {
    const parsed = StoryFile.safeParse(src.data);
    if (!parsed.success) {
      errors.push({ source: src.path, message: 'Schema: ' + parsed.error.issues[0].message });
      continue;
    }
    for (const block of parsed.data) {
      // An empty block_id can't be referenced by a manifest segment, so the block
      // silently never plays (this is exactly how a top-of-sheet cue row with no
      // block_id got orphaned). Catch it at the source.
      if (!block.block_id.trim()) {
        errors.push({ source: src.path, message: 'Block has an empty block_id' });
        continue;
      }
      const existing = pool.get(block.block_id);
      if (existing) {
        errors.push({ source: src.path, segmentId: block.block_id,
          message: `Duplicate segment_id (also in ${existing.source})` });
        continue;
      }
      pool.set(block.block_id, { block, source: src.path });
    }
  }
  return { pool, errors };
}

export function validateBlocks(
  pool: Map<string, { block: Block; source: string }>,
  config: GameConfig,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const chars = new Set([...config.characters.map(c => c.id), ...RESERVED]);
  const targets = new Set([...config.axes, ...config.counters.map(c => c.id)]);

  for (const { block, source } of pool.values()) {
    const ctx = { source, segmentId: block.block_id };

    const condCheck = (cond?: string) => {
      if (!cond) return;
      try {
        for (const v of collectConditionRefs(cond).vars) {
          if (!targets.has(v)) errors.push({ ...ctx, message: `Condition uses unknown axis/counter "${v}"` });
        }
      } catch (e) {
        errors.push({ ...ctx, message: `Bad condition "${cond}": ${(e as Error).message}` });
      }
    };
    const fxCheck = (fx?: { axis: string; delta: number }[]) => {
      for (const e of fx ?? [])
        if (!targets.has(e.axis)) errors.push({ ...ctx, message: `Effect targets unknown axis/counter "${e.axis}"` });
    };

    for (const item of block.items) {
      if ('character' in item && item.character && !chars.has(item.character))
        errors.push({ ...ctx, message: `Unknown character "${item.character}"` });
      if ('condition' in item) condCheck(item.condition);
      if ('effects' in item) fxCheck(item.effects);

      if (item.type === 'choice') {
        if (item.character && !chars.has(item.character))
          errors.push({ ...ctx, message: `Unknown choice character "${item.character}"` });
        for (const opt of item.options) { condCheck(opt.condition); fxCheck(opt.effects); }
      }
      if (item.type === 'cue' && !CUE_CHANNELS.includes(item.channel))
        errors.push({ ...ctx, message: `Unknown cue channel "${item.channel}"` });
    }
  }
  return errors;
}

/**
 * Cross-check the manifest against the merged block pool. Catches the silent
 * content bugs that schema validation alone can't see: a segment that points at
 * no block, a block no segment references (orphan — it never plays), a day or
 * segment that references something undeclared.
 */
export function validateManifest(
  pool: Map<string, { block: Block; source: string }>,
  manifest: Manifest,
  source = 'manifest',
): ValidationError[] {
  const errors: ValidationError[] = [];
  const segmentIds = new Set(Object.keys(manifest.segments));

  // Every manifest segment resolves to a block.
  for (const id of segmentIds)
    if (!pool.has(id))
      errors.push({ source, segmentId: id, message: 'Manifest segment has no matching block' });

  // Every block is referenced by a manifest segment (no orphans that never play).
  for (const id of pool.keys())
    if (!segmentIds.has(id))
      errors.push({ source, segmentId: id, message: 'Block is not referenced by any manifest segment (orphan — never plays)' });

  // Every day's segment ref resolves to a declared segment.
  for (const day of manifest.days)
    for (const id of day.segments)
      if (!segmentIds.has(id))
        errors.push({ source, segmentId: id, message: `Day ${day.day} references undeclared segment` });

  // Every segment's thread_id resolves to a declared thread.
  for (const [id, meta] of Object.entries(manifest.segments))
    if (meta.thread_id && !manifest.threads[meta.thread_id])
      errors.push({ source, segmentId: id, message: `Segment references undeclared thread "${meta.thread_id}"` });

  return errors;
}
