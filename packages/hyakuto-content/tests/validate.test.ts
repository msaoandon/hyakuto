import { describe, it, expect } from 'vitest';
import { mergeBlocks, validateBlocks, validateManifest, validateManifestSource, isManifest } from '../src/validate';
import type { GameConfig, Manifest } from '@hyakuto/engine';

const config: GameConfig = {
  axes: ['trust'],
  characters: [{ id: 'Kou', typing_rate: 1 }],
  counters: [{ id: 'candles', start: 100, end: 0, direction: 'down' }],
};

const block = (id: string) => ({
  block_id: id,
  items: [{ type: 'message' as const, character: 'Kou', messages: ['hi'] }],
});

const poolOf = (...ids: string[]) =>
  mergeBlocks([{ path: 'f.json', data: ids.map(block) }]).pool;

const manifest = (over: Partial<Manifest> = {}): Manifest => ({
  days: [{ day: 1, route: 'common', segments: ['demo_1'] }],
  segments: { demo_1: { id: 'demo_1', type: 'group_chat', day: 1, thread_id: 'alpha' } },
  threads: { alpha: { display_name: 'Alpha' } },
  ...over,
});

describe('mergeBlocks id integrity', () => {
  it('flags an empty block_id (the orphaned-cue bug)', () => {
    const { errors, pool } = mergeBlocks([{ path: 'f.json', data: [block(''), block('demo_1')] }]);
    expect(errors.some((e) => e.message.includes('empty block_id'))).toBe(true);
    expect(pool.has('')).toBe(false); // not pooled
  });

  it('flags a duplicate block_id across files', () => {
    const { errors } = mergeBlocks([
      { path: 'a.json', data: [block('demo_1')] },
      { path: 'b.json', data: [block('demo_1')] },
    ]);
    expect(errors.some((e) => e.message.includes('Duplicate'))).toBe(true);
  });
});

describe('validateManifest cross-refs', () => {
  it('passes a consistent manifest + blocks', () => {
    expect(validateManifest(poolOf('demo_1'), manifest())).toEqual([]);
  });

  it('flags an orphan block no segment references (it would never play)', () => {
    const errs = validateManifest(poolOf('demo_1', 'stray'), manifest());
    expect(errs.some((e) => e.segmentId === 'stray' && e.message.includes('orphan'))).toBe(true);
  });

  it('flags a manifest segment with no block', () => {
    const errs = validateManifest(poolOf(), manifest());
    expect(errs.some((e) => e.segmentId === 'demo_1' && e.message.includes('no matching block'))).toBe(true);
  });

  it('flags a day referencing an undeclared segment', () => {
    const m = manifest({ days: [{ day: 1, route: 'common', segments: ['demo_1', 'ghost'] }] });
    const errs = validateManifest(poolOf('demo_1'), m);
    expect(errs.some((e) => e.segmentId === 'ghost' && e.message.includes('undeclared segment'))).toBe(true);
  });

  it('flags a segment with an undeclared thread_id', () => {
    const m = manifest({
      segments: { demo_1: { id: 'demo_1', type: 'group_chat', day: 1, thread_id: 'ghost' } },
    });
    const errs = validateManifest(poolOf('demo_1'), m);
    expect(errs.some((e) => e.message.includes('undeclared thread'))).toBe(true);
  });
});

describe('validateBlocks — VN scene cues, empty text, narrator', () => {
  const poolWith = (items: unknown[]) =>
    mergeBlocks([{ path: 'f.json', data: [{ block_id: 'vn_1', items }] }]).pool;

  it('accepts a scene cue (image file name) and the reserved narrator voice', () => {
    const pool = poolWith([
      { type: 'cue', channel: 'scene', value: 'bookshop.jpg' },
      { type: 'message', character: 'narrator', messages: ['It is quiet.'] },
    ]);
    expect(validateBlocks(pool, config)).toEqual([]);
  });

  it('flags a scene cue with an empty value', () => {
    const pool = poolWith([{ type: 'cue', channel: 'scene', value: '  ' }]);
    const errs = validateBlocks(pool, config);
    expect(errs.some((e) => e.message.includes('Scene cue has an empty value'))).toBe(true);
  });

  it('flags an empty message text', () => {
    const pool = poolWith([{ type: 'message', character: 'narrator', messages: ['  '] }]);
    const errs = validateBlocks(pool, config);
    expect(errs.some((e) => e.message.includes('empty text'))).toBe(true);
  });

  it('accepts localized text (locale maps) on message/choice/pool', () => {
    const pool = poolWith([
      { type: 'message', character: 'Kou', messages: [{ en: 'hi', uk: 'привіт' }] },
      { type: 'choice', options: [{ text: { en: 'Sure', uk: 'Звісно' } }] },
      { type: 'pool', character: 'Kou', variants: [{ text: { en: 'one', uk: 'один' } }] },
    ]);
    expect(validateBlocks(pool, config)).toEqual([]);
  });

  it('flags a locale map with a blank translation', () => {
    const pool = poolWith([{ type: 'message', character: 'Kou', messages: [{ en: 'hi', uk: '  ' }] }]);
    const errs = validateBlocks(pool, config);
    expect(errs.some((e) => e.message.includes('empty text'))).toBe(true);
  });

  it('accepts valid context predicates (if_time / if_gender)', () => {
    const pool = poolWith([
      { type: 'message', character: 'Kou', messages: ['Evening, you.'],
        condition: '(time:evening OR time:night) AND gender:female' },
    ]);
    expect(validateBlocks(pool, config)).toEqual([]);
  });

  it('flags an unknown time band as a bad condition', () => {
    const pool = poolWith([
      { type: 'message', character: 'Kou', messages: ['hi'], condition: 'time:lunchtime' },
    ]);
    const errs = validateBlocks(pool, config);
    expect(errs.some((e) => e.message.includes('Bad condition'))).toBe(true);
  });
});

describe('validateManifest — homogeneous thread type', () => {
  it('flags a thread that mixes chat and vn segments', () => {
    const m = manifest({
      days: [{ day: 1, route: 'common', segments: ['demo_1', 'demo_2'] }],
      segments: {
        demo_1: { id: 'demo_1', type: 'group_chat', day: 1, thread_id: 'alpha' },
        demo_2: { id: 'demo_2', type: 'vn', day: 1, thread_id: 'alpha' },
      },
    });
    const errs = validateManifest(poolOf('demo_1', 'demo_2'), m);
    expect(errs.some((e) => e.message.includes('mixes segment types'))).toBe(true);
  });

  it('flags a DM thread that uses wall-clock unlock_after', () => {
    const m = manifest({
      days: [{ day: 1, route: 'common', segments: ['demo_1'] }],
      segments: { demo_1: { id: 'demo_1', type: 'dm', day: 1, thread_id: 'dm_ren' } },
      threads: { dm_ren: { display_name: 'Ren', unlock_after: '18:00' } },
    });
    const errs = validateManifest(poolOf('demo_1'), m);
    expect(errs.some((e) => e.message.includes('unlock_after'))).toBe(true);
  });
});

describe('isManifest', () => {
  it('recognizes the manifest envelope and rejects a block array', () => {
    expect(isManifest(manifest())).toBe(true);
    expect(isManifest([block('demo_1')])).toBe(false);
    expect(isManifest(null)).toBe(false);
  });
});

describe('validateManifestSource — shape boundary', () => {
  it('cross-checks a well-formed manifest source (parses, then no errors)', () => {
    expect(validateManifestSource(poolOf('demo_1'), manifest(), 'm.json')).toEqual([]);
  });

  it('returns a clean error (not a throw) for a malformed shape', () => {
    // `type` outside the enum: isManifest would pass it through; the schema catches it.
    const bad = manifest({ segments: { demo_1: { id: 'demo_1', type: 'bogus' } } } as never);
    const errs = validateManifestSource(poolOf('demo_1'), bad, 'm.json');
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatchObject({ source: 'm.json' });
    expect(errs[0].message).toMatch(/Invalid manifest/);
  });

  it('flags a missing required field (thread display_name)', () => {
    const bad = manifest({ threads: { alpha: {} } } as never);
    const errs = validateManifestSource(poolOf('demo_1'), bad, 'm.json');
    expect(errs[0].message).toMatch(/Invalid manifest/);
  });
});
