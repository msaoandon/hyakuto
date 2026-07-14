import { describe, it, expect } from 'vitest';
import { PlayerSave, migratePlayerSave, PLAYER_SAVE_VERSION } from '../src/index';

// A realistic snapshot: every field populated the way the web store produces it
// (Cyrillic name, recorded choices, completion timestamps, DM cursors).
const snapshot = {
  schemaVersion: PLAYER_SAVE_VERSION,
  save: {
    axes: { tatsumi: 2, ren: 0, kou: 1 },
    counters: { candles: 93 },
    flags: ['asked_lantern'],
    poolSelections: { demo_d1_s1_pool_4: 1 },
    gender: 'female',
    choices: { demo_d1_s2__10: 'demo_d1_s2__10__o1' },
  },
  mc: { name: 'Юкі', pronouns: 'she' },
  mcChosen: true,
  completed: { '1:demo_d1_t1': 1760000000000 },
  dmRead: { demo_dm1: ['demo_dm1_1'] },
};

describe('PlayerSave contract', () => {
  it('accepts a realistic full snapshot', () => {
    expect(PlayerSave.parse(snapshot)).toEqual(snapshot);
  });

  it('accepts the minimal fresh-profile shape (optional engine fields absent)', () => {
    const fresh = {
      schemaVersion: 1,
      save: { axes: {}, counters: { candles: 100 }, flags: [], poolSelections: {} },
      mc: { name: '', pronouns: 'they' },
      mcChosen: false,
      completed: {},
      dmRead: {},
    };
    expect(() => PlayerSave.parse(fresh)).not.toThrow();
  });

  it('rejects malformed payloads with a located message', () => {
    const bad = { ...snapshot, save: { ...snapshot.save, flags: 'nope' } };
    expect(() => migratePlayerSave(bad)).toThrow(/save\.flags/);
  });
});

describe('migratePlayerSave', () => {
  it('passes a current-version payload through', () => {
    expect(migratePlayerSave(snapshot)).toEqual(snapshot);
  });

  it('refuses unknown old versions (no silent data loss)', () => {
    expect(() => migratePlayerSave({ ...snapshot, schemaVersion: 0 })).toThrow(/No migration path/);
  });

  it('refuses payloads from the future', () => {
    expect(() => migratePlayerSave({ ...snapshot, schemaVersion: 99 })).toThrow(/newer than supported/);
  });

  it('refuses non-objects', () => {
    expect(() => migratePlayerSave(null)).toThrow(/expected an object/);
  });
});
