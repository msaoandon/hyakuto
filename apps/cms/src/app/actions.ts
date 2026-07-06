"use server";

import { revalidatePath } from "next/cache";
import {
  WorldConfig, Segment, ThreadKind, newUnit, slugifyId, uniqueId,
  type WorldConfigT, type MusicThemeDefT, type ProjectT, type ThreadT,
} from "@hyakuto/cms-core";
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

/** Import the current demo *into* an existing game, keeping its id + name. This is
 *  the "start empty, fill in later" path — it replaces the game's content (world +
 *  threads + days + segments), so the UI confirms first when the game isn't empty. */
export async function importDemo(gameId: string): Promise<ActionResult> {
  try {
    const store = getCatalog().store(gameId);
    const existing = await store.load();
    const project = await seedFromDemo(existing.workspace.id, existing.workspace.name);
    await store.save(project);
    revalidatePath("/", "layout");
    return { ok: true };
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

// ─── STORY STRUCTURE (§VI.3 — days / threads / segments) ─────────────────────
// Every mutation below is load → transform → save; `store.save` re-parses the
// whole project, so no transform can persist an invalid shape. Ids are minted
// here (managed, §III.2) — the client never supplies one.

/** Load-mutate-save wrapper; `mutate` throws to reject (message reaches the UI). */
async function withGame(gameId: string, mutate: (p: ProjectT) => ProjectT): Promise<ActionResult> {
  try {
    await mutateGame(gameId, mutate);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function mutateGame(gameId: string, mutate: (p: ProjectT) => ProjectT): Promise<void> {
  const store = getCatalog().store(gameId);
  await store.save(mutate(await store.load()));
  revalidatePath("/", "layout");
}

/** Append the next day on a route: index = last+1, id minted from route+index. */
export async function createDay(gameId: string, route: string): Promise<CreateResult> {
  try {
    let id = "";
    await mutateGame(gameId, (p) => {
      const routeId = slugifyId(route, "main");
      const index = Math.max(0, ...p.days.filter((d) => d.route === routeId).map((d) => d.index)) + 1;
      id = uniqueId(`${routeId}__d${index}`, new Set(p.days.map((d) => d.id)));
      return { ...p, days: [...p.days, { id, index, route: routeId, segmentIds: [] }] };
    });
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Create a thread. `kind` fixes the type of every segment in it (that is the
 *  model's single-kind guarantee); `contact` (dm only) must be a known character. */
export async function createThread(
  gameId: string,
  input: { name: string; kind: string; contact?: string },
): Promise<CreateResult> {
  try {
    let id = "";
    await mutateGame(gameId, (p) => {
      const name = input.name.trim();
      if (!name) throw new Error("Give the thread a name.");
      const kind = ThreadKind.parse(input.kind);
      if (input.contact && !p.world.characters.some((c) => c.id === input.contact))
        throw new Error(`Unknown contact character "${input.contact}"`);
      id = uniqueId(slugifyId(name, "thread"), new Set(p.threads.map((t) => t.id)));
      const thread: ThreadT = {
        id, kind,
        display_name: newUnit(`${id}__name`, p.workspace.defaultLocale, name),
        ...(kind === "dm" && input.contact ? { contact: input.contact } : {}),
      };
      return { ...p, threads: [...p.threads, thread] };
    });
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Create an empty segment in a day — in a thread, or thread-less (= system). */
export async function createSegment(gameId: string, dayId: string, threadId?: string): Promise<CreateResult> {
  try {
    let id = "";
    await mutateGame(gameId, (p) => {
      const day = p.days.find((d) => d.id === dayId);
      if (!day) throw new Error(`Unknown day "${dayId}"`);
      if (threadId && !p.threads.some((t) => t.id === threadId))
        throw new Error(`Unknown thread "${threadId}"`);
      id = uniqueId(`d${day.index}_${threadId ?? "system"}`, new Set(p.segments.map((s) => s.id)));
      return {
        ...p,
        segments: [...p.segments, { id, ...(threadId ? { threadId } : {}), lines: [] }],
        days: p.days.map((d) => (d.id === dayId ? { ...d, segmentIds: [...d.segmentIds, id] } : d)),
      };
    });
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Persist one segment from the grid. The id is the key — it must already exist
 *  (segments are only born via createSegment), and its thread ref must resolve. */
export async function saveSegment(gameId: string, segment: unknown): Promise<ActionResult> {
  return withGame(gameId, (p) => {
    const parsed = Segment.parse(segment);
    if (!p.segments.some((s) => s.id === parsed.id)) throw new Error(`Unknown segment "${parsed.id}"`);
    if (parsed.threadId && !p.threads.some((t) => t.id === parsed.threadId))
      throw new Error(`Unknown thread "${parsed.threadId}"`);
    return { ...p, segments: p.segments.map((s) => (s.id === parsed.id ? parsed : s)) };
  });
}

/** Reorder a segment within its day (dir −1 = up, +1 = down; edges are no-ops). */
export async function moveSegment(gameId: string, dayId: string, segmentId: string, dir: -1 | 1): Promise<ActionResult> {
  return withGame(gameId, (p) => ({
    ...p,
    days: p.days.map((d) => {
      if (d.id !== dayId) return d;
      const i = d.segmentIds.indexOf(segmentId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.segmentIds.length) return d;
      const order = [...d.segmentIds];
      [order[i], order[j]] = [order[j], order[i]];
      return { ...d, segmentIds: order };
    }),
  }));
}

/** Delete a segment and its day membership (its lines go with it). */
export async function deleteSegment(gameId: string, segmentId: string): Promise<ActionResult> {
  return withGame(gameId, (p) => ({
    ...p,
    segments: p.segments.filter((s) => s.id !== segmentId),
    days: p.days.map((d) =>
      d.segmentIds.includes(segmentId) ? { ...d, segmentIds: d.segmentIds.filter((id) => id !== segmentId) } : d,
    ),
  }));
}

/** Delete a thread — only when no segment references it (no silent orphans). */
export async function deleteThread(gameId: string, threadId: string): Promise<ActionResult> {
  return withGame(gameId, (p) => {
    const used = p.segments.filter((s) => s.threadId === threadId).length;
    if (used > 0) throw new Error(`Thread is used by ${used} segment(s) — delete or move them first.`);
    return { ...p, threads: p.threads.filter((t) => t.id !== threadId) };
  });
}

/** Delete a day — only when it holds no segments. */
export async function deleteDay(gameId: string, dayId: string): Promise<ActionResult> {
  return withGame(gameId, (p) => {
    const day = p.days.find((d) => d.id === dayId);
    if (!day) throw new Error(`Unknown day "${dayId}"`);
    if (day.segmentIds.length > 0) throw new Error("Day still has segments — delete them first.");
    return { ...p, days: p.days.filter((d) => d.id !== dayId) };
  });
}

/** Declare a scene id (minted from the VN scene picker while authoring — scenes
 *  are world data, but their natural authoring moment is segment editing). */
export async function addScene(gameId: string, sceneId: string): Promise<ActionResult> {
  return withGame(gameId, (p) => {
    const id = sceneId.trim();
    if (!id) throw new Error("Scene id can't be empty.");
    if (p.world.scenes.some((s) => s.id === id)) return p;
    return { ...p, world: { ...p.world, scenes: [...p.world.scenes, { id }] } };
  });
}

/** Declare a story flag (minted from the option "remember as" picker — flags are
 *  world data, but they're born at the option that sets them). */
export async function addFlag(gameId: string, flagId: string): Promise<ActionResult> {
  return withGame(gameId, (p) => {
    const id = flagId.trim();
    if (!id) throw new Error("Flag id can't be empty.");
    if (!/^[a-z0-9][a-z0-9_]*$/.test(id))
      throw new Error(`Flag id "${id}" must be a lowercase slug (a-z 0-9 _) — it appears in conditions.`);
    if (p.world.flags.some((f) => f.id === id)) return p;
    return { ...p, world: { ...p.world, flags: [...p.world.flags, { id }] } };
  });
}
