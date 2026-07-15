import { PLAYER_SAVE_VERSION, PlayerSave, type PlayerSaveT } from "@hyakuto/player-save";
import type { SaveState } from "@hyakuto/engine";
import { API, syncEnabled } from "./apiBase";

// Push-only save sync to the local apps/api (DEV_PLAN Phase 3). Deliberately:
//  - OPT-IN: without NEXT_PUBLIC_API_URL every call is a no-op — IndexedDB
//    stays the source of truth, offline-first behavior is unchanged, e2e and
//    the Capacitor build never depend on a server.
//  - fire-and-forget + debounced: a dead API can never block or slow play.
//  - validated OUTBOUND with the same shared schema the API validates inbound —
//    a drifted payload fails here first, loudly.
//  - bearer-authenticated: the caller (the store) resolves/mints a session
//    token via authClient before calling pushSave — identity is never a URL
//    param, it's the request's Authorization header.
// Pull/restore lands with the guest-migration slice.
// Slot is caller-supplied (the store's currentSlot) — sync always targets
// whichever save is actually active locally, never a hardcoded slot.

const DEBOUNCE_MS = 1500;

export type SaveSnapshot = {
  save: SaveState;
  mc: { name: string; pronouns: "they" | "she" | "he" };
  mcChosen: boolean;
  completed: Record<string, number>;
  dmRead: Record<string, string[]>;
};

/** Store snapshot → validated contract payload (throws on drift — fail fast). */
export function buildPlayerSave(s: SaveSnapshot): PlayerSaveT {
  return PlayerSave.parse({
    schemaVersion: PLAYER_SAVE_VERSION,
    save: s.save,
    mc: s.mc,
    mcChosen: s.mcChosen,
    completed: s.completed,
    dmRead: s.dmRead,
  });
}

let pending: { token: string; slot: number; snapshot: SaveSnapshot } | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Debounced push of the latest snapshot (key events call this). `token` is a
 *  bearer session the caller has already resolved (see gameStore.sync);
 *  `slot` is the store's currentSlot. */
export function pushSave(token: string, slot: number, snapshot: SaveSnapshot): void {
  if (!API) return;
  pending = { token, slot, snapshot };
  clearTimeout(timer);
  timer = setTimeout(() => {
    const { token: t, slot: s, snapshot: snap } = pending!;
    pending = null;
    let payload: PlayerSaveT;
    try {
      payload = buildPlayerSave(snap);
    } catch (err) {
      console.error("save sync: payload drift —", err);
      return;
    }
    fetch(`${API}/v1/me/slots/${s}`, {
      method: "PUT",
      headers: { "content-type": "application/json", authorization: `Bearer ${t}` },
      body: JSON.stringify(payload),
      keepalive: true, // survives tab close mid-push
    }).catch((err) => console.warn("save sync failed (will retry on next event):", err));
  }, DEBOUNCE_MS);
}

/** New game: the server copy goes too (the local reset already wiped IDB). */
export function pushSlotDelete(token: string | null, slot: number): void {
  if (!API || !token) return;
  clearTimeout(timer);
  pending = null;
  fetch(`${API}/v1/me/slots/${slot}`, { method: "DELETE", headers: { authorization: `Bearer ${token}` }, keepalive: true }).catch(
    (err) => console.warn("save-slot delete failed:", err),
  );
}

export { syncEnabled };
