import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { dirname, join } from 'node:path';
import { Project, migrateProject } from './schema/project';
import type { Project as ProjectT } from './schema/project';

// ─── PROJECT STORE (§IV) ──────────────────────────────────────────────────────
// The seam between the CMS and where the project physically lives. "Local file
// now", "installed on an author's machine", and "hosted Supabase backend" (Phase
// 4) are the *same interface* with a different implementation — no code fork. The
// root path is configurable so content can live in a gitignored folder outside
// the repo (the narrative-game norm: open engine, private story).

export interface ProjectStore {
  /** Whether a project exists at this location yet. */
  exists(): Promise<boolean>;
  /** Load, migrate forward, and validate. Throws loudly on a malformed project. */
  load(): Promise<ProjectT>;
  /** Validate, then persist. Overwrites the current project. */
  save(project: ProjectT): Promise<void>;
}

/**
 * File-backed store: the whole normalized project is one JSON document at
 * `<root>/<fileName>`. Writes are atomic — serialize to a temp file, then rename
 * over the target — so a crash or concurrent write can never leave a half-written
 * (corrupt) project on disk. The Supabase implementation of this interface is
 * Phase 4; nothing above this seam changes when it arrives.
 */
export class FileProjectStore implements ProjectStore {
  private readonly path: string;

  constructor(rootDir: string, fileName = 'project.json') {
    this.path = join(rootDir, fileName);
  }

  async exists(): Promise<boolean> {
    try {
      await stat(this.path);
      return true;
    } catch {
      return false;
    }
  }

  async load(): Promise<ProjectT> {
    const raw = await readFile(this.path, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Project file at ${this.path} is not valid JSON: ${(e as Error).message}`);
    }
    return migrateProject(parsed);
  }

  async save(project: ProjectT): Promise<void> {
    // Validate before touching disk — never persist an invalid project.
    const valid = Project.parse(project);
    await mkdir(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    await writeFile(tmp, JSON.stringify(valid, null, 2), 'utf8');
    await rename(tmp, this.path); // atomic replace on POSIX + Windows
  }
}

// ─── WORKSPACE CATALOG (§III.3 — the workspace/game dimension) ────────────────
// The CMS manages *many* games; each is a workspace-scoped Project. The catalog is
// the collection seam over the data dir: it lists games and hands out a per-game
// ProjectStore. One folder per game (`<root>/<workspaceId>/project.json`) maps
// one-to-one to a Supabase `projects` table row in Phase 4 — so going multi-tenant
// stays a store swap, never a data migration (the Project schema was workspace-
// scoped from day one). The individual game store is unchanged.

export interface WorkspaceSummary {
  id: string;
  name: string;
}

export interface WorkspaceCatalog {
  /** All games, by workspace summary (id + name). */
  list(): Promise<WorkspaceSummary[]>;
  /** Whether a game with this id exists. */
  has(id: string): Promise<boolean>;
  /** The per-game project store. */
  store(id: string): ProjectStore;
  /** Persist a new game; fails if its id is already taken. */
  create(project: ProjectT): Promise<void>;
  /** Delete a game and all its content. */
  remove(id: string): Promise<void>;
}

// A workspace id becomes a folder name, so it must be a safe, traversal-proof slug.
// Reject anything else loudly rather than risk writing outside the data dir.
function assertSafeId(id: string): string {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(id))
    throw new Error(`Invalid workspace id "${id}" (expected a lowercase slug: a-z 0-9 - _)`);
  return id;
}

export class FileWorkspaceCatalog implements WorkspaceCatalog {
  constructor(private readonly rootDir: string) {}

  store(id: string): ProjectStore {
    return new FileProjectStore(join(this.rootDir, assertSafeId(id)));
  }

  has(id: string): Promise<boolean> {
    return this.store(id).exists();
  }

  async list(): Promise<WorkspaceSummary[]> {
    // No data dir yet → no games.
    const entries = await readdir(this.rootDir, { withFileTypes: true }).catch(() => [] as Dirent[]);
    const games: WorkspaceSummary[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const store = new FileProjectStore(join(this.rootDir, entry.name));
      if (!(await store.exists())) continue;
      try {
        const project = await store.load();
        games.push({ id: project.workspace.id, name: project.workspace.name });
      } catch {
        // Skip a corrupt/unreadable game rather than failing the whole listing.
      }
    }
    return games.sort((a, b) => a.name.localeCompare(b.name));
  }

  async create(project: ProjectT): Promise<void> {
    const id = assertSafeId(project.workspace.id);
    if (await this.has(id)) throw new Error(`A game with id "${id}" already exists`);
    await this.store(id).save(project);
  }

  async remove(id: string): Promise<void> {
    await rm(join(this.rootDir, assertSafeId(id)), { recursive: true, force: true });
  }
}
