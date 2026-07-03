import { describe, it, expect } from 'vitest';
import type { Block, GameConfig, Manifest } from '@hyakuto/engine';
import { importProject, compile } from '../src/index';
// Dev-only: reach into @hyakuto/content's validator to prove the compiled output
// passes the real CI gate. Not part of cms-core's runtime surface.
import { mergeBlocks, validateBlocks, validateManifest } from '@hyakuto/content/src/validate';

// A compact but representative slice of the delivery format, exercising every
// content type, localized + plain-string values, effects, a freeform condition,
// group_chat / dm / vn threads, a DM contact, a VN scene, and an ost. It stands in
// for the real demo/manifest/gameConfig so the round-trip test stays hermetic and
// doesn't reach into apps/web.
const gameConfig: GameConfig = {
  axes: ['kou', 'tatsumi', 'ren'],
  characters: [
    { id: 'Kou', typing_rate: 0.6 },
    { id: 'Tatsumi', typing_rate: 1.4 },
    { id: 'Ren', typing_rate: 1.2 },
  ],
  counters: [{ id: 'candles', start: 100, end: 0, direction: 'down' }],
};

// blocks are declared in the same order as manifest.segments keys, because compile
// emits blocks in segment order — array order must match for a deep round-trip.
const blocks: Block[] = [
  {
    block_id: 'g1',
    items: [
      { type: 'status', text: { en: '{MC} joined the chatroom.', uk: '{MC} приєдналася.' } },
      { type: 'message', character: 'Kou', messages: [{ en: 'how old are you', uk: 'скільки тобі років' }] },
      { type: 'message', character: 'Tatsumi', messages: [{ en: 'Old.', uk: 'Багато.' }], effects: [{ axis: 'tatsumi', delta: 1 }] },
      {
        type: 'choice',
        options: [
          { text: { en: 'A dragon god?', uk: 'Дракон-бог?' } },
          { text: { en: 'Where do you live?', uk: 'Де ти живеш?' }, effects: [{ axis: 'kou', delta: 1 }] },
        ],
      },
      {
        type: 'pool',
        character: 'Kou',
        variants: [
          { text: { en: 'iconic. terrifying', uk: 'культово. моторошно' }, weight: 1 },
          { text: 'he says this SO casually', weight: 2 },
        ],
      },
      { type: 'image', character: 'Kou', file: 'kou_dinner.jpg' },
      { type: 'typing', character: 'Kou' },
      { type: 'cue', channel: 'music', value: 'night' },
      { type: 'message', character: 'Ren', messages: [{ en: 'THE DRAGON STIRS', uk: 'ДРАКОН ПРОБУДЖУЄТЬСЯ' }], condition: '(tatsumi>0)' },
    ],
  },
  {
    block_id: 'dm1',
    items: [
      { type: 'message', character: 'Tatsumi', messages: [{ en: 'I am also awake.', uk: 'Я теж не сплю.' }] },
      { type: 'sticker', character: 'Tatsumi', file: 'wave.png' },
    ],
  },
  {
    block_id: 'v1',
    items: [
      { type: 'cue', channel: 'scene', value: 'mountain' },
      { type: 'message', character: 'Ren', messages: [{ en: 'What lives on the mountain?', uk: 'Що живе на горі?' }] },
      { type: 'choice', character: 'Ren', options: [{ text: { en: 'A tengu.', uk: 'Тенґу.' } }] },
    ],
  },
];

const manifest: Manifest = {
  days: [
    { day: 1, route: 'common', segments: ['g1', 'dm1'] },
    { day: 2, route: 'common', segments: ['v1'] },
  ],
  segments: {
    g1: { id: 'g1', type: 'group_chat', route: 'common', day: 1, thread_id: 't_g1' },
    dm1: { id: 'dm1', type: 'dm', route: 'common', day: 1, thread_id: 't_dm' },
    v1: { id: 'v1', type: 'vn', route: 'common', day: 2, thread_id: 't_v1', scene: 'mountain' },
  },
  threads: {
    t_g1: { display_name: { en: 'The Group Chat at 3 AM', uk: 'Груповий чат о 3-й ночі' } },
    t_dm: { display_name: { en: 'Tatsumi', uk: 'Тацумі' }, contact: 'Tatsumi' },
    t_v1: { display_name: 'What Lives on the Mountain', ost: 'kaidan' },
  },
};

describe('import → compile round-trip', () => {
  const project = importProject({ blocks, manifest, gameConfig, workspace: { id: 'demo', name: 'Hyakutō', defaultLocale: 'en' } });
  const compiled = compile(project);

  it('reproduces the gameConfig', () => {
    expect(compiled.gameConfig).toEqual(gameConfig);
  });

  it('reproduces the manifest (days, segments, threads)', () => {
    expect(compiled.manifest).toEqual(manifest);
  });

  it('reproduces the blocks exactly', () => {
    expect(compiled.blocks).toEqual(blocks);
  });

  it('discovers every locale used in the content', () => {
    expect(project.workspace.locales.sort()).toEqual(['en', 'uk']);
  });

  it('records thread kinds derived from segment types', () => {
    const kinds = Object.fromEntries(project.threads.map((t) => [t.id, t.kind]));
    expect(kinds).toEqual({ t_g1: 'group_chat', t_dm: 'dm', t_v1: 'vn' });
  });

  it('passes the real @hyakuto/content validator with zero errors', () => {
    const { pool, errors: mergeErrors } = mergeBlocks([{ path: 'compiled', data: compiled.blocks }]);
    const blockErrors = validateBlocks(pool, compiled.gameConfig);
    const manifestErrors = validateManifest(pool, compiled.manifest);
    expect([...mergeErrors, ...blockErrors, ...manifestErrors]).toEqual([]);
  });
});
