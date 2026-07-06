import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { StoryFile, parseManifest } from "@hyakuto/engine";
import { gameConfig } from "@hyakuto/game";
import { importProject, CURRENT_SCHEMA_VERSION, Project, type ProjectT } from "@hyakuto/cms-core";

// Bootstrap sources. The current demo/manifest live in apps/web (a throwaway
// show-off game); reading them here is the one-time migration the importer exists
// for. Real content is authored per-game in the CMS's gitignored data dir.
const WEB_DATA = join(process.cwd(), "..", "web", "src", "data");

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(join(WEB_DATA, file), "utf8"));
}

/** Import today's demo/manifest/gameConfig into a fresh game. Parses the JSON
 *  through the engine's own schemas first, so a malformed source fails loudly. */
export async function seedFromDemo(id: string, name: string): Promise<ProjectT> {
  const blocks = StoryFile.parse(await readJson("demo.json"));
  const manifest = parseManifest(await readJson("manifest.json"));
  return importProject({ blocks, manifest, gameConfig, workspace: { id, name, defaultLocale: "en" } });
}

/** A minimal valid empty game — the "start from scratch" bootstrap. */
export function emptyProject(id: string, name: string): ProjectT {
  return Project.parse({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    workspace: { id, name, defaultLocale: "en", locales: ["en"] },
    world: {},
  });
}
