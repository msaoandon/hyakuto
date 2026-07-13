import { get, set, del } from "idb-keyval";

// The MC avatar lives in IndexedDB under its own key — deliberately NOT inside
// the Zustand-persisted JSON (which re-serializes on every save write; a base64
// image there would bloat every autosave). It is also deliberately not part of
// the server save blob later: photos map to object storage (Supabase Storage,
// Phase 4), not a database row. Wiped by reset() with the MC identity.
//
// Stored as raw bytes + mime, NOT as a Blob: WebKit cannot store Blobs in
// IndexedDB in ephemeral/private sessions (the write aborts with a null error),
// while ArrayBuffers store everywhere. The Blob is reconstructed on read.

const KEY = "hyakuto-mc-avatar";

type StoredAvatar = { bytes: ArrayBuffer; type: string };

const hasIdb = () => typeof indexedDB !== "undefined"; // SSR / node tests

export async function readMcAvatar(): Promise<Blob | null> {
  if (!hasIdb()) return null;
  const stored = await get<StoredAvatar>(KEY);
  return stored ? new Blob([stored.bytes], { type: stored.type }) : null;
}

export async function writeMcAvatar(blob: Blob): Promise<void> {
  if (!hasIdb()) return;
  await set(KEY, { bytes: await blob.arrayBuffer(), type: blob.type } satisfies StoredAvatar);
}

export async function deleteMcAvatar(): Promise<void> {
  if (!hasIdb()) return;
  await del(KEY);
}
