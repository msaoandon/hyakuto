import "server-only";
import { notFound } from "next/navigation";
import type { ProjectT } from "@hyakuto/cms-core";
import { getCatalog } from "./store";

// Load a game by id, or 404 if it doesn't exist. Used by every game-scoped page so
// a missing/deleted id resolves cleanly to notFound() — never an uncaught load
// error — independent of layout/page render ordering.
export async function loadGame(id: string): Promise<ProjectT> {
  const store = getCatalog().store(id);
  if (!(await store.exists())) notFound();
  return store.load();
}
