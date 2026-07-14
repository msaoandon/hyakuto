import { PLAYER_SAVE_VERSION, PlayerSave, type PlayerSaveT } from "@hyakuto/player-save";
import type { SaveState } from "@hyakuto/engine";

// Push-only save sync to the local apps/api (DEV_PLAN Phase 3). Deliberately:
//  - OPT-IN: without NEXT_PUBLIC_API_URL every call is a no-op — IndexedDB
//    stays the source of truth, offline-first behavior is unchanged, e2e and
//    the Capacitor build never depend on a server.
//  - fire-and-forget + debounced: a dead API can never block or slow play.
//  - validated OUTBOUND with the same shared schema the API validates inbound —
//    a drifted payload fails here first, loudly.
// Pull/restore lands with accounts (the guest-migration slice).

const API = process.env.NEXT_PUBLIC_API_URL;
const SLOT = 0; // single profile today; slots are a schema capability, UI later
const DEBOUNCE_MS = 1500;

export type SaveSnapshot = {
  playerId: string;
  save: SaveState;
  mc: { name: string; pronouns: "they" | "she" | "he" };
  mcChosen: boolean;
  completed: Record<string, number>;
  dmRead: Record<string, string[]>;
};

/** Store snapshot → validated contract payload (throws on drift — fail fast). */
export function buildPlayerSave(s: Omit<SaveSnapshot, "playerId">): PlayerSaveT {
  return PlayerSave.parse({
    schemaVersion: PLAYER_SAVE_VERSION,
    save: s.save,
    mc: s.mc,
    mcChosen: s.mcChosen,
    completed: s.completed,
    dmRead: s.dmRead,
  });
}

let pending: SaveSnapshot | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Debounced push of the latest snapshot (key events call this). */
export function pushSave(snapshot: SaveSnapshot): void {
  if (!API) return;
  pending = snapshot;
  clearTimeout(timer);
  timer = setTimeout(() => {
    const s = pending!;
    pending = null;
    let payload: PlayerSaveT;
    try {
      payload = buildPlayerSave(s);
    } catch (err) {
      console.error("save sync: payload drift —", err);
      return;
    }
    fetch(`${API}/v1/players/${s.playerId}/slots/${SLOT}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true, // survives tab close mid-push
    }).catch((err) => console.warn("save sync failed (will retry on next event):", err));
  }, DEBOUNCE_MS);
}

/** New game: the server copy goes too (the local reset already wiped IDB). */
export function pushSlotDelete(playerId: string): void {
  if (!API) return;
  clearTimeout(timer);
  pending = null;
  fetch(`${API}/v1/players/${playerId}/slots/${SLOT}`, { method: "DELETE", keepalive: true })
    .catch((err) => console.warn("save-slot delete failed:", err));
}
