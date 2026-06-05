import { StoryFile, collectConditionRefs } from '@hyakuto/engine';
import type { Block, GameConfig } from '@hyakuto/engine';

export type ValidationError = { source: string; segmentId?: string; message: string };
export type ContentSource = { path: string; data: unknown };

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
