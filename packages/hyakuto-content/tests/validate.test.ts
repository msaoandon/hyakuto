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

describe('choice identity + choice: refs (the branching contract)', () => {
  const choiceBlock = (blockId: string, choiceId?: string, optionIds: (string | undefined)[] = ['o1', 'o2']) => ({
    block_id: blockId,
    items: [
      { type: 'message' as const, character: 'Kou', messages: ['pick'] },
      {
        type: 'choice' as const,
        ...(choiceId ? { id: choiceId } : {}),
        options: optionIds.map((id, i) => ({ ...(id ? { id } : {}), text: `opt ${i}` })),
      },
    ],
  });
  const gated = (blockId: string, condition: string) => ({
    block_id: blockId,
    items: [{ type: 'message' as const, character: 'Kou', messages: ['later'], condition }],
  });
  const poolFor = (...blocks: object[]) => mergeBlocks([{ path: 'f.json', data: blocks }]).pool;

  it('accepts a resolving choice: ref (block, segment, and thread gates)', () => {
    const pool = poolFor(choiceBlock('b1', 'c1'), gated('b2', 'choice:c1==o2'));
    expect(validateBlocks(pool, config)).toEqual([]);
    const m = manifest({
      days: [{ day: 1, route: 'common', segments: ['b1', 'b2'] }],
      segments: {
        b1: { id: 'b1', type: 'group_chat', day: 1, thread_id: 'alpha' },
        b2: { id: 'b2', type: 'group_chat', day: 1, thread_id: 'alpha', condition: 'choice:c1==o1' },
      },
      threads: { alpha: { display_name: 'Alpha', condition: 'choice:c1==o1' } },
    });
    expect(validateManifest(pool, m)).toEqual([]);
  });

  it('flags a ref to an unknown choice, and to an unknown option', () => {
    const pool = poolFor(choiceBlock('b1', 'c1'), gated('b2', 'choice:ghost==o1 AND choice:c1==nope'));
    const msgs = validateBlocks(pool, config).map((e) => e.message);
    expect(msgs).toContainEqual(expect.stringContaining('unknown choice "ghost"'));
    expect(msgs).toContainEqual(expect.stringContaining('unknown option "nope"'));
  });

  it('flags a dangling choice: ref in a manifest segment gate', () => {
    const pool = poolFor(choiceBlock('demo_1', 'c1'));
    const m = manifest({
      segments: { demo_1: { id: 'demo_1', type: 'group_chat', day: 1, thread_id: 'alpha', condition: 'choice:c1==missing' } },
    });
    const msgs = validateManifest(pool, m).map((e) => e.message);
    expect(msgs).toContainEqual(expect.stringContaining('unknown option "missing"'));
  });

  it('flags duplicate choice ids across blocks and duplicate option ids within one', () => {
    const dupes = poolFor(choiceBlock('b1', 'c1'), choiceBlock('b2', 'c1'));
    expect(validateBlocks(dupes, config).map((e) => e.message))
      .toContainEqual(expect.stringContaining('Duplicate choice id "c1"'));
    const dupOpts = poolFor(choiceBlock('b1', 'c1', ['same', 'same']));
    expect(validateBlocks(dupOpts, config).map((e) => e.message))
      .toContainEqual(expect.stringContaining('Duplicate option id "same"'));
  });

  it('flags option ids under an id-less choice (unreferenceable)', () => {
    const pool = poolFor(choiceBlock('b1', undefined, ['o1']));
    expect(validateBlocks(pool, config).map((e) => e.message))
      .toContainEqual(expect.stringContaining('choice has no id'));
  });

  it('legacy id-less choices stay valid (back-compat)', () => {
    const pool = poolFor(choiceBlock('b1', undefined, [undefined, undefined]));
    expect(validateBlocks(pool, config)).toEqual([]);
  });
});

describe('flags — declared allowlist (gameConfig.flags)', () => {
  const flagged = { ...config, flags: ['asked_lantern'] };
  const withOption = (set_flag?: string, condition?: string) => mergeBlocks([{ path: 'f.json', data: [{
    block_id: 'b1',
    items: [
      { type: 'message' as const, character: 'Kou', messages: ['pick'], ...(condition ? { condition } : {}) },
      { type: 'choice' as const, id: 'c1', options: [{ id: 'o1', text: 'ok', ...(set_flag ? { set_flag } : {}) }] },
    ],
  }] }]).pool;

  it('accepts a declared set_flag and flag: ref', () => {
    expect(validateBlocks(withOption('asked_lantern', 'flag:asked_lantern'), flagged)).toEqual([]);
  });

  it('flags an undeclared set_flag on an option', () => {
    expect(validateBlocks(withOption('ghost'), flagged).map((e) => e.message))
      .toContainEqual(expect.stringContaining('undeclared flag "ghost"'));
  });

  it('flags an undeclared flag: condition ref (kills flag typos)', () => {
    expect(validateBlocks(withOption(undefined, 'flag:asked_lantren'), flagged).map((e) => e.message))
      .toContainEqual(expect.stringContaining('undeclared flag "asked_lantren"'));
  });
});
