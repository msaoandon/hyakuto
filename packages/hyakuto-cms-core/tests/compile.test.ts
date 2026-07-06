import { describe, it, expect } from 'vitest';
import { compile, combineGate, branchPredicate, Project } from '../src/index';
import type { Project as ProjectT } from '../src/index';

function project(over: Partial<ProjectT> = {}): ProjectT {
  return Project.parse({
    schemaVersion: 1,
    workspace: { id: 'w', name: 'Demo', defaultLocale: 'en', locales: ['en'] },
    world: { axes: [{ id: 'kou' }], characters: [{ id: 'Kou', typing_rate: 0.6 }], counters: [] },
    threads: [{ id: 't1', kind: 'group_chat', display_name: { id: 'tn', text: { en: 'Chat' } } }],
    days: [{ id: 'd1', index: 1, route: 'common', segmentIds: ['s1'] }],
    segments: [{
      id: 's1', threadId: 't1',
      lines: [{ type: 'message', id: 's1__0', character: 'Kou', text: { id: 'l0', text: { en: 'hi' } } }],
    }],
    ...over,
  });
}

describe('combineGate', () => {
  it('passes a single clause through verbatim (round-trip fidelity)', () => {
    expect(combineGate('(tatsumi>0)', undefined)).toBe('(tatsumi>0)');
    expect(combineGate(undefined, { choiceId: 'c', optionId: 'o' })).toBe('choice:c==o');
  });

  it('ANDs a condition with a branch, parenthesising each clause', () => {
    expect(combineGate('(tatsumi>0)', { choiceId: 'c', optionId: 'o' }))
      .toBe('((tatsumi>0)) AND (choice:c==o)');
  });

  it('is undefined when nothing gates', () => {
    expect(combineGate(undefined, undefined)).toBeUndefined();
    expect(combineGate('   ', undefined)).toBeUndefined();
  });
});

describe('branchPredicate', () => {
  it('renders the engine choice predicate by stable ids', () => {
    expect(branchPredicate({ choiceId: 'd1_greet', optionId: 'warm' })).toBe('choice:d1_greet==warm');
  });
});

describe('compile', () => {
  it('generates gameConfig from the world config', () => {
    const { gameConfig } = compile(project());
    expect(gameConfig.axes).toEqual(['kou']);
    expect(gameConfig.characters).toEqual([{ id: 'Kou', typing_rate: 0.6 }]);
    expect(gameConfig.counters).toEqual([]);
  });

  it('derives a segment type from its thread kind, not a stored field', () => {
    const { manifest } = compile(project());
    expect(manifest.segments.s1.type).toBe('group_chat');
    expect(manifest.segments.s1.route).toBe('common');
    expect(manifest.segments.s1.day).toBe(1);
  });

  it('treats a segment with no thread as a system segment', () => {
    const p = project({
      days: [{ id: 'd1', index: 1, route: 'common', segmentIds: ['sys'] }],
      segments: [{ id: 'sys', lines: [] }],
    });
    const { manifest, blocks } = compile(Project.parse(p));
    expect(manifest.segments.sys.type).toBe('system');
    // A segment with no lines produces no block.
    expect(blocks.find((b) => b.block_id === 'sys')).toBeUndefined();
  });

  it('produces one block per segment with content, items in order', () => {
    const { blocks } = compile(project());
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      block_id: 's1',
      items: [{ type: 'message', character: 'Kou', messages: ['hi'] }],
    });
  });

  it('compiles a branch relationship into a choice: predicate on the gated line', () => {
    const p = project({
      segments: [{
        id: 's1', threadId: 't1',
        lines: [{
          type: 'message', id: 's1__0', character: 'Kou',
          text: { id: 'l0', text: { en: 'only if warm' } },
          branch: { choiceId: 'greet', optionId: 'warm' },
        }],
      }],
    });
    const { blocks } = compile(Project.parse(p));
    const msg = blocks[0].items[0];
    expect(msg).toMatchObject({ type: 'message', condition: 'choice:greet==warm' });
  });

  it('ships choice + option ids (the identity the engine records picks under)', () => {
    const p = project({
      segments: [{
        id: 's1', threadId: 't1',
        lines: [
          { type: 'message', id: 's1__0', character: 'Kou', text: { id: 's1__0', text: { en: 'pick' } } },
          {
            type: 'choice', id: 's1__1',
            options: [
              { id: 's1__1__o0', text: { id: 's1__1__o0', text: { en: 'A' } } },
              { id: 's1__1__o1', text: { id: 's1__1__o1', text: { en: 'B' } }, branch: { choiceId: 'earlier', optionId: 'x' } },
            ],
          },
        ],
      }],
    });
    const { blocks } = compile(Project.parse(p));
    expect(blocks[0].items[1]).toEqual({
      type: 'choice',
      id: 's1__1',
      options: [
        { id: 's1__1__o0', text: 'A' },
        { id: 's1__1__o1', text: 'B', condition: 'choice:earlier==x' },
      ],
    });
  });

  it('compiles a segment-level branch into the manifest gate', () => {
    const p = project({
      segments: [{
        id: 's1', threadId: 't1', condition: 'kou>1',
        branch: { choiceId: 'greet', optionId: 'warm' }, lines: [],
      }],
    });
    const { manifest } = compile(Project.parse(p));
    expect(manifest.segments.s1.condition).toBe('(kou>1) AND (choice:greet==warm)');
  });

  it('fails fast when a segment references an unknown thread', () => {
    const p = project({
      segments: [{ id: 's1', threadId: 'ghost', lines: [] }],
    });
    expect(() => compile(Project.parse(p))).toThrow(/unknown thread "ghost"/);
  });
});
