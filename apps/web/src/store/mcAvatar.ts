import { get, set, del, keys } from "idb-keyval";

// The MC avatar lives in IndexedDB under its own key — deliberately NOT inside
// the Zustand-persisted JSON (which re-serializes on every save write; a base64
// image there would bloat every autosave). It is also deliberately not part of
// the server save blob later: photos map to object storage (Supabase Storage,
// Phase 4), not a database row. Wiped by reset() with the MC identity.
//
// Keyed per save slot: the avatar shares the MC identity's lifecycle (per
// docs/worldbuilding/mc.md), and each slot is a distinct playthrough with its
// own MC — switching slots must switch the avatar with it, and erasing one
// slot (New Game) must never touch another slot's photo.
//
// Stored as raw bytes + mime, NOT as a Blob: WebKit cannot store Blobs in
// IndexedDB in ephemeral/private sessions (the write aborts with a null error),
// while ArrayBuffers store everywhere. The Blob is reconstructed on read.

const PREFIX = "hyakuto-mc-avatar";
const LEGACY_KEY = PREFIX; // pre-slots: the one and only (implicitly slot 0) avatar
const keyFor = (slot: number) => `${PREFIX}-${slot}`;

type StoredAvatar = { bytes: ArrayBuffer; type: string };

const hasIdb = () => typeof indexedDB !== "undefined"; // SSR / node tests

export async function readMcAvatar(slot: number): Promise<Blob | null> {
  if (!hasIdb()) return null;
  let stored = await get<StoredAvatar>(keyFor(slot));
  if (!stored && slot === 0) {
    // One-time migration: an avatar saved before multi-slot support existed
    // lived under the unscoped legacy key, which was always slot 0's photo.
    const legacy = await get<StoredAvatar>(LEGACY_KEY);
    if (legacy) {
      await set(keyFor(0), legacy);
      await del(LEGACY_KEY);
      stored = legacy;
    }
  }
  return stored ? new Blob([stored.bytes], { type: stored.type }) : null;
}

export async function writeMcAvatar(slot: number, blob: Blob): Promise<void> {
  if (!hasIdb()) return;
  await set(keyFor(slot), { bytes: await blob.arrayBuffer(), type: blob.type } satisfies StoredAvatar);
}

export async function deleteMcAvatar(slot: number): Promise<void> {
  if (!hasIdb()) return;
  await del(keyFor(slot));
}

/** Full local wipe across every slot (account deletion) — after the account
 *  and all its server-side slots are gone, no locally cached avatar can be
 *  paired with a save anymore; leaving them behind would just be orphaned
 *  bytes with no way to reach them again. */
export async function deleteAllMcAvatars(): Promise<void> {
  if (!hasIdb()) return;
  const all = await keys();
  await Promise.all(
    all.filter((k): k is string => typeof k === "string" && k.startsWith(PREFIX)).map((k) => del(k)),
  );
}
