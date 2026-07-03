import { describe, it, expect } from 'vitest';
import {
  Project, CURRENT_SCHEMA_VERSION, migrateProject,
  compileLocalized, unitFromLocalized,
} from '../src/index';

describe('project schema', () => {
  it('fills structural defaults so a minimal project is valid', () => {
    const p = Project.parse({
      schemaVersion: 1,
      workspace: { id: 'w', name: 'Demo' },
      world: {},
    });
    expect(p.workspace.defaultLocale).toBe('en');
    expect(p.workspace.locales).toEqual(['en']);
    expect(p.world.axes).toEqual([]);
    // Cue channels default to the set the engine/content layer understands.
    expect(p.world.cueChannels.map((c) => c.id)).toEqual(['music', 'glitch', 'scene']);
    expect(p.days).toEqual([]);
  });

  it('the current schema version is a stable literal', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
    expect(() => Project.parse({ schemaVersion: 2, workspace: { id: 'w', name: 'x' }, world: {} }))
      .toThrow();
  });
});

describe('migrateProject', () => {
  const base = { schemaVersion: 1, workspace: { id: 'w', name: 'x' }, world: {} };

  it('validates and returns a well-formed project', () => {
    expect(migrateProject(base).schemaVersion).toBe(1);
  });

  it('rejects a non-object', () => {
    expect(() => migrateProject(null)).toThrow(/expected an object/);
    expect(() => migrateProject(42)).toThrow(/expected an object/);
  });

  it('refuses a project newer than the supported version', () => {
    expect(() => migrateProject({ ...base, schemaVersion: 999 })).toThrow(/newer than supported/);
  });

  it('has no migration path from an unknown older version yet', () => {
    // schemaVersion 0 has no registered step → loud failure, not a silent load.
    expect(() => migrateProject({ ...base, schemaVersion: 0 })).toThrow(/No migration path/);
  });

  it('locates the first shape violation in the error message', () => {
    expect(() => migrateProject({ schemaVersion: 1, workspace: { id: 'w' }, world: {} }))
      .toThrow(/Invalid project at workspace\.name/);
  });
});

describe('translatable units', () => {
  it('compiles to a plain string when only the default locale is present', () => {
    const unit = unitFromLocalized('hello', 'u1', 'en');
    expect(unit.text).toEqual({ en: 'hello' });
    expect(compileLocalized(unit, 'en')).toBe('hello');
  });

  it('compiles to a locale map when a translation is present', () => {
    const unit = unitFromLocalized({ en: 'hello', uk: 'привіт' }, 'u2', 'en');
    expect(compileLocalized(unit, 'en')).toEqual({ en: 'hello', uk: 'привіт' });
  });

  it('keeps the map when the only locale is not the default', () => {
    const unit = unitFromLocalized({ uk: 'привіт' }, 'u3', 'en');
    expect(compileLocalized(unit, 'en')).toEqual({ uk: 'привіт' });
  });
});
