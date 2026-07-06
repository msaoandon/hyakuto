import { StoryFile, collectConditionRefs, RESERVED_CHARACTERS, parseManifest, localizedValues } from '@hyakuto/engine';
import type { Block, GameConfig, Manifest, Localized } from '@hyakuto/engine';

/** A translatable value is "empty" if it carries no locale, or any of its
 *  per-locale texts is blank. Replaces the schema-level `.min(1)` lost when the
 *  fields became locale maps. */
function emptyLocalized(value: Localized): boolean {
  const vals = localizedValues(value);
  return vals.length === 0 || vals.some((s) => !s.trim());
}

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

const RESERVED = [...RESERVED_CHARACTERS];
const CUE_CHANNELS = ['music', 'glitch', 'scene'];

/**
 * Index every id-carrying choice in the pool: choiceId → its option-id set.
 * Also flags identity errors — duplicate choice ids (a `choice:` ref must be
 * unambiguous), duplicate option ids within a choice, and options that carry
 * ids under a choice that has none (unreferenceable half-state).
 */
function collectChoiceIndex(pool: Map<string, { block: Block; source: string }>) {
  const index = new Map<string, Set<string>>();
  const owner = new Map<string, string>(); // choiceId → first block seen in
  const errors: ValidationError[] = [];

  for (const { block, source } of pool.values()) {
    const ctx = { source, segmentId: block.block_id };
    for (const item of block.items) {
      if (item.type !== 'choice') continue;
      if (!item.id) {
        if (item.options.some((o) => o.id))
          errors.push({ ...ctx, message: 'Choice options carry ids but the choice has no id — nothing can reference them' });
        continue;
      }
      if (index.has(item.id)) {
        errors.push({ ...ctx, message: `Duplicate choice id "${item.id}" (also in block "${owner.get(item.id)}")` });
        continue;
      }
      const options = new Set<string>();
      for (const opt of item.options) {
        if (!opt.id) continue;
        if (options.has(opt.id))
          errors.push({ ...ctx, message: `Duplicate option id "${opt.id}" in choice "${item.id}"` });
        options.add(opt.id);
      }
      index.set(item.id, options);
      owner.set(item.id, block.block_id);
    }
  }
  return { index, errors };
}

/** Check every `choice:` ref in a condition against the choice index. */
function checkChoiceRefs(
  refs: { choiceId: string; optionId: string }[],
  index: Map<string, Set<string>>,
  push: (message: string) => void,
) {
  for (const ref of refs) {
    const options = index.get(ref.choiceId);
    if (!options) push(`Condition references unknown choice "${ref.choiceId}"`);
    else if (!options.has(ref.optionId))
      push(`Condition references unknown option "${ref.optionId}" of choice "${ref.choiceId}"`);
  }
}

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
  const chars = new Set([...config.characters.map(c => c.id), ...RESERVED]);
  const targets = new Set([...config.axes, ...config.counters.map(c => c.id)]);
  const flags = new Set(config.flags ?? []);
  const { index: choiceIndex, errors } = collectChoiceIndex(pool);

  for (const { block, source } of pool.values()) {
    const ctx = { source, segmentId: block.block_id };

    const condCheck = (cond?: string) => {
      if (!cond) return;
      try {
        const refs = collectConditionRefs(cond);
        for (const v of refs.vars) {
          if (!targets.has(v)) errors.push({ ...ctx, message: `Condition uses unknown axis/counter "${v}"` });
        }
        for (const f of refs.flags) {
          if (!flags.has(f)) errors.push({ ...ctx, message: `Condition references undeclared flag "${f}"` });
        }
        checkChoiceRefs(refs.choices, choiceIndex, (message) => errors.push({ ...ctx, message }));
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

      if (item.type === 'message')
        for (const m of item.messages)
          if (emptyLocalized(m)) errors.push({ ...ctx, message: 'Message has empty text' });

      if (item.type === 'pool')
        for (const v of item.variants)
          if (emptyLocalized(v.text)) errors.push({ ...ctx, message: 'Pool variant has empty text' });

      if (item.type === 'status' && emptyLocalized(item.text))
        errors.push({ ...ctx, message: 'Status has empty text' });

      if (item.type === 'choice') {
        if (item.character && !chars.has(item.character))
          errors.push({ ...ctx, message: `Unknown choice character "${item.character}"` });
        for (const opt of item.options) {
          if (emptyLocalized(opt.text)) errors.push({ ...ctx, message: 'Choice option has empty text' });
          condCheck(opt.condition);
          fxCheck(opt.effects);
          if (opt.set_flag && !flags.has(opt.set_flag))
            errors.push({ ...ctx, message: `Option sets undeclared flag "${opt.set_flag}"` });
        }
      }
      if (item.type === 'cue') {
        if (!CUE_CHANNELS.includes(item.channel))
          errors.push({ ...ctx, message: `Unknown cue channel "${item.channel}"` });
        else if (item.channel === 'scene' && !item.value.trim())
          errors.push({ ...ctx, message: 'Scene cue has an empty value (expected an image file name)' });
      }
    }
  }
  return errors;
}

/**
 * Validate a manifest *source* (untrusted JSON) before cross-checking it: first
 * parse its shape with the engine's `Manifest` schema, then run the cross-refs.
 * A malformed shape returns a clean error instead of crashing the cross-ref pass
 * — `isManifest` is only a file-type discriminator (manifest vs block file), not
 * a correctness claim. This is the CI gate's entry point for manifest files.
 */
export function validateManifestSource(
  pool: Map<string, { block: Block; source: string }>,
  data: unknown,
  source = 'manifest',
): ValidationError[] {
  let manifest: Manifest;
  try {
    manifest = parseManifest(data);
  } catch (e) {
    return [{ source, message: (e as Error).message }];
  }
  return validateManifest(pool, manifest, source);
}

/**
 * Cross-check the manifest against the merged block pool. Catches the silent
 * content bugs that schema validation alone can't see: a segment that points at
 * no block, a block no segment references (orphan — it never plays), a day or
 * segment that references something undeclared. Operates on an already-parsed
 * Manifest; use validateManifestSource at the untrusted boundary.
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

  // A thread's segments must share one type, so its render kind (chat vs VN vs
  // DM) is unambiguous — a thread can't be half chat, half VN.
  const threadType = new Map<string, { type: string; first: string }>();
  for (const [id, meta] of Object.entries(manifest.segments)) {
    if (!meta.thread_id) continue;
    const seen = threadType.get(meta.thread_id);
    if (!seen) threadType.set(meta.thread_id, { type: meta.type, first: id });
    else if (seen.type !== meta.type)
      errors.push({
        source,
        segmentId: id,
        message: `Thread "${meta.thread_id}" mixes segment types (${seen.type} in "${seen.first}", ${meta.type} here)`,
      });
  }

  // DMs are relationship-gated, not wall-clock gated — `unlock_after` is the
  // chat model and would silently do nothing on a DM thread. Flag it.
  for (const [tid, t] of threadType) {
    if (t.type === "dm" && manifest.threads[tid]?.unlock_after)
      errors.push({
        source,
        segmentId: t.first,
        message: `DM thread "${tid}" has unlock_after — DMs gate by condition, not wall-clock`,
      });
  }

  // Segment/thread gates may reference recorded choices — every `choice:` ref
  // must resolve to a real choice + option in the block pool (a dangling ref is
  // forever-false gating: the content silently never plays).
  const { index: choiceIndex } = collectChoiceIndex(pool); // identity errors already reported by validateBlocks
  const gateCheck = (cond: string | undefined, ctx: ValidationError) => {
    if (!cond) return;
    try {
      checkChoiceRefs(collectConditionRefs(cond).choices, choiceIndex, (message) => errors.push({ ...ctx, message }));
    } catch (e) {
      errors.push({ ...ctx, message: `Bad condition "${cond}": ${(e as Error).message}` });
    }
  };
  for (const [id, meta] of Object.entries(manifest.segments))
    gateCheck(meta.condition, { source, segmentId: id, message: '' });
  for (const [tid, t] of Object.entries(manifest.threads))
    gateCheck(t.condition, { source, segmentId: tid, message: '' });

  return errors;
}
