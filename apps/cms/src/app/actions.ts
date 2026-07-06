"use server";

import { revalidatePath } from "next/cache";
import { WorldConfig, type WorldConfigT, type MusicThemeDefT } from "@hyakuto/cms-core";
import { getCatalog } from "@/lib/store";
import { emptyProject, seedFromDemo } from "@/lib/seed";

// ─── SERVER ACTION BOUNDARY ───────────────────────────────────────────────────
// The only way the browser reaches the store. Every mutation is scoped to a game
// (workspace) id and runs the catalog/ProjectStore on the Node side (file now,
// Supabase in Phase 4). Swapping the backend never touches the client.

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

// A display name → a safe, unique workspace id (folder/row key). Never derived
// from anything mutable after creation.
function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "game";
}

/** Create a new game — by importing today's demo, or empty. Returns its id. */
export async function createGame(name: string, mode: "demo" | "empty"): Promise<CreateResult> {
  try {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: "Give the game a name." };
    const catalog = getCatalog();

    // Dedupe the id so two games can share a display name.
    const base = slugify(trimmed);
    let id = base;
    for (let n = 2; await catalog.has(id); n++) id = `${base}-${n}`;

    const project = mode === "demo" ? await seedFromDemo(id, trimmed) : emptyProject(id, trimmed);
    await catalog.create(project);
    revalidatePath("/", "layout");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Delete a game and all its content. */
export async function deleteGame(id: string): Promise<ActionResult> {
  try {
    await getCatalog().remove(id);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Persist the world-editor fields for one game. Validated here (never trust the
 *  client), then merged over the stored world so sections edited elsewhere (scenes
 *  → segment authoring, musicThemes → the OST section) are never clobbered. */
export async function saveWorld(gameId: string, world: WorldConfigT): Promise<ActionResult> {
  try {
    const parsed = WorldConfig.parse(world);
    const store = getCatalog().store(gameId);
    const project = await store.load();
    const merged = {
      ...project.world, // preserve scenes + musicThemes (owned by other sections)
      characters: parsed.characters,
      axes: parsed.axes,
      counters: parsed.counters,
      flags: parsed.flags,
      cueChannels: parsed.cueChannels,
    };
    await store.save({ ...project, world: merged });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Persist a game's OST track list (music themes). Merged into the world; the whole
 *  project is re-validated on save, so a blank id / bad shape fails loudly. */
export async function saveMusicThemes(gameId: string, themes: MusicThemeDefT[]): Promise<ActionResult> {
  try {
    const store = getCatalog().store(gameId);
    const project = await store.load();
    await store.save({ ...project, world: { ...project.world, musicThemes: themes } });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
