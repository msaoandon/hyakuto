import { get, set, del } from "idb-keyval";

// The MC avatar lives as a Blob under its own IndexedDB key — deliberately NOT
// inside the Zustand-persisted JSON (which re-serializes on every save write; a
// base64 image there would bloat every autosave). It is also deliberately not
// part of the server save blob later: photos map to object storage (Supabase
// Storage, Phase 4), not a database row. Wiped by reset() with the MC identity.

const KEY = "hyakuto-mc-avatar";

const hasIdb = () => typeof indexedDB !== "undefined"; // SSR / node tests

export async function readMcAvatar(): Promise<Blob | null> {
  if (!hasIdb()) return null;
  return (await get<Blob>(KEY)) ?? null;
}

export async function writeMcAvatar(blob: Blob): Promise<void> {
  if (!hasIdb()) return;
  await set(KEY, blob);
}

export async function deleteMcAvatar(): Promise<void> {
  if (!hasIdb()) return;
  await del(KEY);
}
