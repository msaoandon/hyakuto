import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { StoryFile, parseManifest } from "@hyakuto/engine";
import { gameConfig } from "@hyakuto/game";
import { importProject, CURRENT_SCHEMA_VERSION, Project, type ProjectT } from "@hyakuto/cms-core";

// Bootstrap sources. The current demo/manifest live in apps/web (a throwaway
// show-off game); reading them here is the one-time migration the importer exists
// for. Real content will live in the gitignored data dir, authored in the CMS.
const WEB_DATA = join(process.cwd(), "..", "web", "src", "data");

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(join(WEB_DATA, file), "utf8"));
}

/** Import today's demo/manifest/gameConfig into a fresh project. Parses the JSON
 *  through the engine's own schemas first, so a malformed source fails loudly. */
export async function seedFromDemo(): Promise<ProjectT> {
  const blocks = StoryFile.parse(await readJson("demo.json"));
  const manifest = parseManifest(await readJson("manifest.json"));
  return importProject({
    blocks,
    manifest,
    gameConfig,
    workspace: { id: "hyakuto", name: "Hyakutō", defaultLocale: "en" },
  });
}

/** A minimal valid empty project — the "start from scratch" bootstrap. */
export function emptyProject(): ProjectT {
  return Project.parse({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    workspace: { id: "hyakuto", name: "Hyakutō", defaultLocale: "en", locales: ["en"] },
    world: {},
  });
}
