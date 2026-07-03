import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
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
