"use server";

import { revalidatePath } from "next/cache";
import { WorldConfig, type WorldConfigT } from "@hyakuto/cms-core";
import { getStore } from "@/lib/store";
import { emptyProject, seedFromDemo } from "@/lib/seed";

// ─── SERVER ACTION BOUNDARY ───────────────────────────────────────────────────
// The only way the browser reaches the project store. Each action runs on the
// Node side, drives the ProjectStore (file now, Supabase in Phase 4), and returns
// plain serializable data. Swapping the backend never touches the client.

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Create the initial project — either by importing today's demo, or empty. */
export async function initProject(mode: "demo" | "empty"): Promise<ActionResult> {
  try {
    const project = mode === "demo" ? await seedFromDemo() : emptyProject();
    await getStore().save(project);
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Persist an edited world config back into the project. The world is validated
 *  here (never trust the client), then the whole project is re-validated on save. */
export async function saveWorld(world: WorldConfigT): Promise<ActionResult> {
  try {
    const parsed = WorldConfig.parse(world);
    const store = getStore();
    const project = await store.load();
    await store.save({ ...project, world: parsed });
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
