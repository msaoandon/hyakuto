import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileProjectStore, FileWorkspaceCatalog, Project } from '../src/index';
import type { Project as ProjectT } from '../src/index';

const game = (id: string, name: string): ProjectT =>
  Project.parse({ schemaVersion: 1, workspace: { id, name }, world: {} });

const sample: ProjectT = Project.parse({
  schemaVersion: 1,
  workspace: { id: 'w', name: 'Demo' },
  world: { axes: [{ id: 'kou' }], characters: [{ id: 'Kou', typing_rate: 1 }] },
  threads: [{ id: 't1', kind: 'group_chat', display_name: { id: 'n', text: { en: 'Chat' } } }],
  days: [{ id: 'd1', index: 1, route: 'common', segmentIds: ['s1'] }],
  segments: [{ id: 's1', threadId: 't1', lines: [] }],
});

describe('FileProjectStore', () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'cms-store-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('reports absence before anything is saved', async () => {
    const store = new FileProjectStore(dir);
    expect(await store.exists()).toBe(false);
  });

  it('saves and loads a project losslessly', async () => {
    const store = new FileProjectStore(dir);
    await store.save(sample);
    expect(await store.exists()).toBe(true);
    expect(await store.load()).toEqual(sample);
  });

  it('creates the target directory if missing', async () => {
    const store = new FileProjectStore(join(dir, 'nested', 'data'));
    await store.save(sample);
    expect(await store.load()).toEqual(sample);
  });

  it('leaves no temp file behind after an atomic write', async () => {
    const store = new FileProjectStore(dir);
    await store.save(sample);
    await expect(readFile(join(dir, 'project.json.tmp'), 'utf8')).rejects.toThrow();
  });

  it('fails loudly on malformed JSON rather than returning a broken project', async () => {
    await writeFile(join(dir, 'project.json'), '{ not json', 'utf8');
    await expect(new FileProjectStore(dir).load()).rejects.toThrow(/not valid JSON/);
  });

  it('fails loudly when the stored project violates the schema', async () => {
    await writeFile(join(dir, 'project.json'), JSON.stringify({ schemaVersion: 1 }), 'utf8');
    await expect(new FileProjectStore(dir).load()).rejects.toThrow(/Invalid project/);
  });
});

describe('FileWorkspaceCatalog', () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'cms-cat-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('lists nothing when the data dir is empty or absent', async () => {
    expect(await new FileWorkspaceCatalog(join(dir, 'nope')).list()).toEqual([]);
    expect(await new FileWorkspaceCatalog(dir).list()).toEqual([]);
  });

  it('creates games in per-id folders and lists them by summary', async () => {
    const cat = new FileWorkspaceCatalog(dir);
    await cat.create(game('umi', 'Umi no Uta'));
    await cat.create(game('yoru', 'Yoru'));
    expect(await cat.list()).toEqual([
      { id: 'umi', name: 'Umi no Uta' }, // sorted by name: "U" < "Y"
      { id: 'yoru', name: 'Yoru' },
    ]);
    expect(await cat.has('umi')).toBe(true);
    expect(await cat.store('umi').load()).toEqual(game('umi', 'Umi no Uta'));
  });

  it('refuses to create a game whose id is already taken', async () => {
    const cat = new FileWorkspaceCatalog(dir);
    await cat.create(game('umi', 'A'));
    await expect(cat.create(game('umi', 'B'))).rejects.toThrow(/already exists/);
  });

  it('removes a game and everything under it', async () => {
    const cat = new FileWorkspaceCatalog(dir);
    await cat.create(game('umi', 'Umi'));
    await cat.remove('umi');
    expect(await cat.has('umi')).toBe(false);
    expect(await cat.list()).toEqual([]);
  });

  it('rejects an unsafe workspace id rather than escaping the data dir', () => {
    const cat = new FileWorkspaceCatalog(dir);
    expect(() => cat.store('../evil')).toThrow(/Invalid workspace id/);
  });
});
