import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createGameState, DEFAULT_GENDER, type MCGender, type SaveState, type GameState } from "@hyakuto/engine";
import { gameConfig } from "@hyakuto/game";
import { type Locale, DEFAULT_LOCALE, matchDeviceLocale } from "@/i18n/locales";
import { idbStorage } from "./idbStorage";
import { readMcAvatar, writeMcAvatar, deleteMcAvatar, deleteAllMcAvatars } from "./mcAvatar";
import type { PlayerSaveT } from "@hyakuto/player-save";
import { pushSave, pushSlotDelete, syncEnabled, type SaveSnapshot } from "@/data/saveSync";
import {
  mintGuestSession,
  revokeSession,
  deleteAccount as deleteAccountRequest,
  fetchServerSlot,
  listSlots,
  deleteSlot as deleteSlotRequest,
  type AuthAccount,
} from "@/data/authClient";

// MC customisation (docs/worldbuilding/mc.md): name + pronouns are presentation
// state and live here; gender-for-address is ENGINE state and lives in
// save.gender (setMc writes it through) — never duplicated. The avatar is an
// IndexedDB blob (see mcAvatar.ts); only its object URL passes through the store.
export type McPronouns = "they" | "she" | "he";
export type McProfile = { name: string; pronouns: McPronouns };
export const MC_NAME_MAX = 20;
const EMPTY_MC: McProfile = { name: "", pronouns: "they" };

// Player chat-speed preference is a 1–9 level (1 slowest … 9 fastest). Level 5
// is the default. Each level maps to an engine delay multiplier; the mapping is
// the single tunable source. Level 5 = 1.5× (the prior "slow" default); higher
// levels speed the drip up, lower levels slow it down.
export const PACE_LEVEL_MIN = 1;
export const PACE_LEVEL_MAX = 9;
export const DEFAULT_PACE_LEVEL = 5;

// index = level - 1. Monotonically decreasing (higher level → less delay → faster).
const PACE_MULTIPLIERS = [3.0, 2.5, 2.0, 1.75, 1.5, 1.15, 0.85, 0.6, 0.4];

export function clampPaceLevel(level: number): number {
  return Math.min(PACE_LEVEL_MAX, Math.max(PACE_LEVEL_MIN, Math.round(level)));
}

/** The engine delay multiplier for a 1–9 chat-speed level. */
export function paceMultiplier(level: number): number {
  return PACE_MULTIPLIERS[clampPaceLevel(level) - 1]!;
}

function freshSave(): SaveState {
  const s = createGameState(gameConfig);
  return {
    axes: s.axes,
    counters: s.counters,
    flags: [...s.flags],
    poolSelections: s.poolSelections,
    gender: s.gender,
  };
}

type GameStore = {
  save: SaveState;
  /** The save-sync bearer session: a guest (account: null) until the player
   *  signs in, then the linked account's identity. Persisted so a guest token
   *  survives reloads — losing it would mint a new guest player server-side on
   *  every launch and break the "adopt on first sign-in" path. null before the
   *  first sync attempt (nothing minted yet — sync is opt-in). */
  session: { token: string; account: AuthAccount | null } | null;
  /** True once the player has made an explicit auth choice — signed in OR
   *  tapped "Continue as guest" on /login. Gates /login the same way mcChosen
   *  gates /welcome; never checked (and so never blocks anything) when sync
   *  is disabled — a build with no API has no account concept to choose
   *  between. Persisted. */
  authChoiceMade: boolean;
  /** Returns a usable bearer token, minting a guest session on first use if
   *  none exists yet. The one place a session is created. */
  ensureSession: () => Promise<string>;
  /** "Continue as guest" on /login: records the choice. Mints nothing — sync
   *  still lazily mints a guest session on the first real sync event, same as
   *  it always has. */
  continueAsGuest: () => void;
  /** Adopt a session returned by authClient.exchangeCode (called from
   *  /auth/return after the OAuth dance completes). Only call this once a
   *  sign-in is known to be conflict-free — see `restoreFromServer` and
   *  `abandonConflictedSignIn` for the case where the exchanged account
   *  already has a save that differs from what's on this device. */
  signIn: (result: { token: string; account: AuthAccount }) => void;
  /** Full local hydration from a server save — a safe full REPLACE, never a
   *  merge. Two call sites, both provably safe to replace: (1) auto-restore
   *  on a provably-fresh device (see /auth/return's `wasFresh` check — there
   *  is nothing local to lose); (2) the player explicitly picking "use this
   *  account's save" when a genuine conflict was surfaced (existing local
   *  progress AND a different existing server save) — MOBA-style: no silent
   *  merge is ever attempted, the player picks one side and the other is
   *  discarded. Always also purges any locally-cached slot-0 avatar photo —
   *  it belonged to whichever playthrough is being replaced, never to the
   *  incoming one. */
  restoreFromServer: (session: { token: string; account: AuthAccount }, payload: PlayerSaveT) => void;
  /** The other half of conflict resolution: the player picked "keep playing
   *  on this device" instead. The just-exchanged account session is never
   *  adopted (nothing was written to `session` for it in the first place —
   *  see /auth/return), so local save/mc/completed/dmRead need no cleanup;
   *  this only tidies up identity. `apps/api`'s token exchange already
   *  revoked the guest token that was traded in, so leaving it in `session`
   *  would leave every subsequent sync silently failing (401) — clear it so
   *  the next sync event mints a fresh guest session, same as `signOut`. The
   *  abandoned account token is also revoked server-side (best-effort — it's
   *  hygiene, not correctness: an unrevoked token is merely an unused live
   *  session, not a safety issue). */
  abandonConflictedSignIn: (abandonedToken: string) => Promise<void>;
  /** Revoke the session server-side and drop it locally. The local save is
   *  untouched — play continues as a guest; the next sync mints a fresh one. */
  signOut: () => Promise<void>;
  /** GDPR: destroy the account and every trace of it server-side, then wipe
   *  local state (save, identity, avatar, session) and un-arm authChoiceMade
   *  so the device is indistinguishable from one that has never launched.
   *  Rejects — and leaves local state untouched — if the server call fails,
   *  so the UI never tells the player their data is gone when it isn't. */
  deleteAccount: () => Promise<void>;
  /** Which server save slot this device is currently playing. Persisted.
   *  Sync (pushSave/pushSlotDelete) and the avatar always target this slot —
   *  switching slots (Saved Games, signed-in only) changes where local play
   *  reads from and writes to. */
  currentSlot: number;
  /** Switch to a different save slot: pulls it from the server and fully
   *  replaces local state (save/mc/completed/dmRead/avatar) — the same "safe
   *  full replace" reasoning as restoreFromServer, except here it's safe
   *  because the player explicitly chose this from the Saved Games list, not
   *  because the device had nothing local to lose. */
  loadSlot: (slot: number) => Promise<void>;
  /** Start a fresh playthrough in a brand-new slot (the next free slot
   *  number) — every existing slot, local or remote, is left untouched. */
  startNewSlot: () => Promise<number>;
  /** Delete a slot server-side. Refuses to delete the slot currently being
   *  played (switch away first) — an active slot must always resolve to
   *  something, so that footgun is structurally blocked, not just a UI
   *  affordance a caller could forget to check. */
  deleteSlot: (slot: number) => Promise<void>;
  /** MC identity (name + pronouns). Persisted; belongs to the playthrough —
   *  reset() clears it (and the avatar) and re-arms the first-run picker. */
  mc: McProfile;
  /** True once the player has been through the picker (or dismissed it with
   *  defaults). False → the entry flow routes through /welcome. Persisted. */
  mcChosen: boolean;
  /** Object URL of the stored avatar blob, or null. Transient — loaded from
   *  IndexedDB after hydration (loadMcAvatar); never serialized. */
  mcAvatarUrl: string | null;
  locale: Locale;
  /** True once the player picked a language themself (Settings / chooser). Until
   *  then the locale follows the device language on each launch; an explicit
   *  pick wins forever after. Persisted. */
  localeChosen: boolean;
  /** Player preference: background music on/off. Persisted; honoured by AudioProvider. */
  musicEnabled: boolean;
  /** Player preference: chat drip speed as a 1–9 level. Persisted; applied live
   *  by useChatEngine (mapped to an engine multiplier via paceMultiplier). */
  chatPaceLevel: number;
  /** Completed thread key (`day:thread_id`) -> completion time (epoch ms). The
   *  timestamp anchors time-gated unlocks, so completion records *when*, not just *whether*. */
  completed: Record<string, number>;
  /** Active cue value per channel during chat playback (transient — not persisted). */
  cues: Record<string, string>;
  /** Whether the chat drip is paused (transient — not persisted). The header
   *  pause button toggles it; useChatEngine pauses/resumes the engine. */
  chatPaused: boolean;
  /** Read cursor per DM thread: the segment ids the player has seen. Drives the
   *  inbox "new message" badge and per-segment effect application on re-entry. */
  dmRead: Record<string, string[]>;
  completeThread: (key: string, save: SaveState) => void;
  markDmRead: (threadId: string, segmentIds: string[]) => void;
  reset: () => void;
  /** Apply picker edits. Name/pronouns merge into `mc`; `gender` writes through
   *  to save.gender (the engine's field). Marks the picker as answered. */
  setMc: (patch: Partial<McProfile> & { gender?: MCGender }) => void;
  /** Load the avatar blob from IndexedDB into an object URL (post-hydration). */
  loadMcAvatar: () => Promise<void>;
  /** Persist a new avatar blob and expose its object URL. */
  setMcAvatar: (blob: Blob) => Promise<void>;
  /** Remove the stored avatar. */
  clearMcAvatar: () => Promise<void>;
  setLocale: (locale: Locale) => void;
  /** Adopt the device language on a fresh profile (no explicit pick yet). Called
   *  after hydration, when the persisted state is known. No-op once chosen. */
  seedLocaleFromDevice: () => void;
  setMusicEnabled: (on: boolean) => void;
  setChatPaceLevel: (level: number) => void;
  setChatPaused: (paused: boolean) => void;
  setCue: (channel: string, value: string) => void;
  clearCues: () => void;
};

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      save: freshSave(),
      session: null,
      authChoiceMade: false,
      currentSlot: 0,
      mc: EMPTY_MC,
      mcChosen: false,
      mcAvatarUrl: null,
      locale: DEFAULT_LOCALE,
      localeChosen: false,
      musicEnabled: true,
      chatPaceLevel: DEFAULT_PACE_LEVEL,
      completed: {},
      cues: {},
      chatPaused: false,
      dmRead: {},
      completeThread: (key, save) => {
        set((s) =>
          key in s.completed ? {} : { save, completed: { ...s.completed, [key]: Date.now() } },
        );
        void syncNow(get);
      },
      markDmRead: (threadId, segmentIds) => {
        set((s) => {
          const seen = new Set([...(s.dmRead[threadId] ?? []), ...segmentIds]);
          return { dmRead: { ...s.dmRead, [threadId]: [...seen] } };
        });
        void syncNow(get);
      },
      // A new game = a new identity: MC name/pronouns/avatar belong to the
      // playthrough (and wiping the save wipes the personal data with it). The
      // session (guest or signed-in account) is untouched — a new game does
      // not sign anyone out.
      reset: () => {
        const slot = get().currentSlot;
        void deleteMcAvatar(slot);
        pushSlotDelete(get().session?.token ?? null, slot); // the server copy goes with the local one
        set({ save: freshSave(), completed: {}, dmRead: {}, mc: EMPTY_MC, mcChosen: false, mcAvatarUrl: null });
      },
      setMc: ({ gender, ...profile }) => {
        set((s) => ({
          mc: { ...s.mc, ...profile },
          mcChosen: true,
          ...(gender !== undefined ? { save: { ...s.save, gender } } : {}),
        }));
        void syncNow(get);
      },
      ensureSession: async () => {
        const existing = get().session?.token;
        if (existing) return existing;
        const token = await mintGuestSession();
        set({ session: { token, account: null } });
        return token;
      },
      continueAsGuest: () => set({ authChoiceMade: true }),
      signIn: ({ token, account }) => set({ session: { token, account }, authChoiceMade: true }),
      restoreFromServer: (session, payload) => {
        void deleteMcAvatar(0); // /auth/return's restore paths always target slot 0 — see comment above
        set({
          session,
          authChoiceMade: true,
          currentSlot: 0,
          save: payload.save,
          mc: payload.mc,
          mcChosen: payload.mcChosen,
          mcAvatarUrl: null,
          completed: payload.completed,
          dmRead: payload.dmRead,
        });
      },
      abandonConflictedSignIn: async (abandonedToken) => {
        await revokeSession(abandonedToken); // best-effort, see comment above
        set({ session: null });
      },
      signOut: async () => {
        const token = get().session?.token;
        if (token) await revokeSession(token);
        set({ session: null }); // the next sync mints a fresh guest session
      },
      deleteAccount: async () => {
        const token = get().session?.token;
        if (token) await deleteAccountRequest(token); // throws on failure — nothing below runs
        void deleteAllMcAvatars(); // every local slot's photo, not just the current one — none are reachable anymore
        set({
          save: freshSave(),
          completed: {},
          dmRead: {},
          mc: EMPTY_MC,
          mcChosen: false,
          mcAvatarUrl: null,
          session: null,
          authChoiceMade: false,
          currentSlot: 0,
        });
      },
      loadSlot: async (slot) => {
        const token = await get().ensureSession();
        const payload = await fetchServerSlot(token, slot);
        set({
          currentSlot: slot,
          save: payload.save,
          mc: payload.mc,
          mcChosen: payload.mcChosen,
          completed: payload.completed,
          dmRead: payload.dmRead,
        });
        await get().loadMcAvatar(); // re-reads under the now-current slot's key
      },
      startNewSlot: async () => {
        const token = await get().ensureSession();
        const existing = await listSlots(token);
        const next = existing.length ? Math.max(...existing.map((s) => s.slot)) + 1 : 0;
        set({ currentSlot: next, save: freshSave(), completed: {}, dmRead: {}, mc: EMPTY_MC, mcChosen: false });
        await get().loadMcAvatar(); // the new slot has no photo yet — clears mcAvatarUrl
        return next;
      },
      deleteSlot: async (slot) => {
        if (slot === get().currentSlot) throw new Error("cannot delete the slot currently being played");
        const token = await get().ensureSession();
        await deleteSlotRequest(token, slot);
      },
      loadMcAvatar: async () => {
        const blob = await readMcAvatar(get().currentSlot);
        set({ mcAvatarUrl: blob ? URL.createObjectURL(blob) : null });
      },
      setMcAvatar: async (blob) => {
        // Preview first — the picked photo must show even if persistence fails
        // (e.g. private-mode storage restrictions); it then lasts the session.
        set({ mcAvatarUrl: URL.createObjectURL(blob), mcChosen: true });
        try {
          await writeMcAvatar(get().currentSlot, blob);
        } catch (err) {
          console.warn("avatar preview only — could not persist:", err);
        }
      },
      clearMcAvatar: async () => {
        await deleteMcAvatar(get().currentSlot);
        set({ mcAvatarUrl: null });
      },
      setLocale: (locale) => set({ locale, localeChosen: true }),
      seedLocaleFromDevice: () => {
        if (get().localeChosen || typeof navigator === "undefined") return;
        const device = matchDeviceLocale(navigator.languages ?? [navigator.language]);
        if (device) set({ locale: device }); // not "chosen" — keeps following the device
      },
      setMusicEnabled: (on) => set({ musicEnabled: on }),
      setChatPaceLevel: (level) => set({ chatPaceLevel: clampPaceLevel(level) }),
      setChatPaused: (paused) => set({ chatPaused: paused }),
      setCue: (channel, value) => set((s) => ({ cues: { ...s.cues, [channel]: value } })),
      clearCues: () => set({ cues: {} }),
    }),
    {
      name: "hyakuto-save",
      version: 6,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        save: s.save,
        session: s.session,
        authChoiceMade: s.authChoiceMade,
        currentSlot: s.currentSlot,
        mc: s.mc,
        mcChosen: s.mcChosen,
        locale: s.locale,
        localeChosen: s.localeChosen,
        musicEnabled: s.musicEnabled,
        chatPaceLevel: s.chatPaceLevel,
        completed: s.completed,
        dmRead: s.dmRead,
      }),
      // v0 stored `completed` as a string[] (membership only). v1 needs timestamps to
      // anchor time-gated unlocks; legacy entries get 0 ("completed long ago"), which
      // leaves any successor's time gate already satisfied — the safe direction.
      // v2 adds `localeChosen`. Existing installs get true — whatever locale they
      // have (picked or lived-with default) must never be silently switched by
      // device seeding; only genuinely fresh profiles follow the device language.
      // v3 adds MC identity. Existing installs get mcChosen: true — a mid-story
      // player must never be interrupted by a first-run picker; their name stays
      // the localized default ("" → fallback) until they visit Settings.
      // v4 replaces the unauthenticated `playerId` (a documented Phase-3
      // shortcut — the client claimed its own identity) with a server-issued
      // `session`. There is no data to carry forward: the old identity was
      // never authenticated, so nothing it synced can be claimed by a new
      // session anyway. Existing installs simply start syncing as a fresh
      // guest on their next sync event — the local save (the thing that
      // actually matters) is untouched.
      // v5 adds `authChoiceMade` (the /login front door). Existing installs
      // get true — never interrupt a mid-story player with a login screen
      // they weren't shown when they started; the new gate only catches
      // genuinely fresh profiles going forward.
      // v6 adds `currentSlot` (Saved Games / multi-slot sync). Every install
      // that predates slots was, by construction, playing what the server
      // already calls slot 0 (saveSync hardcoded it) — 0 is not a guess here,
      // it's the only value that was ever possible.
      migrate: (persisted, version) => {
        const s = persisted as {
          completed?: unknown;
          localeChosen?: boolean;
          mc?: McProfile;
          mcChosen?: boolean;
          playerId?: string;
          session?: unknown;
          authChoiceMade?: boolean;
          currentSlot?: number;
        };
        if (version < 1 && Array.isArray(s.completed)) {
          s.completed = Object.fromEntries((s.completed as string[]).map((k) => [k, 0]));
        }
        if (version < 2) s.localeChosen = true;
        if (version < 3) {
          s.mc = EMPTY_MC;
          s.mcChosen = true;
        }
        if (version < 4) {
          delete s.playerId;
          s.session = null;
        }
        if (version < 5) s.authChoiceMade = true;
        if (version < 6) s.currentSlot = 0;
        return persisted as GameStore;
      },
      skipHydration: true,
    },
  ),
);

/** The slice of store state the sync contract carries (device prefs excluded). */
function snapshot(s: GameStore): SaveSnapshot {
  return { save: s.save, mc: s.mc, mcChosen: s.mcChosen, completed: s.completed, dmRead: s.dmRead };
}

/** Resolve (or lazily mint) a session, then fire the debounced push. Session
 *  failures are swallowed here — sync is best-effort by design; a dead API or
 *  offline device must never block play. */
async function syncNow(get: () => GameStore): Promise<void> {
  if (!syncEnabled) return;
  let token: string;
  try {
    token = await get().ensureSession();
  } catch (err) {
    console.warn("save sync: could not establish a session —", err);
    return;
  }
  pushSave(token, get().currentSlot, snapshot(get()));
}

export function saveToState(
  save: SaveState,
  completed: Record<string, number> = {},
): GameState {
  return {
    axes: { ...save.axes },
    counters: { ...save.counters },
    flags: new Set(save.flags),
    poolSelections: { ...save.poolSelections },
    completed: { ...completed },
    // A legacy save (persisted before gender existed) restores as unset — the
    // inclusive baseline — so no destructive migration is needed.
    gender: save.gender ?? DEFAULT_GENDER,
    // Recorded picks (choiceId → optionId). Legacy saves have none — their old
    // choices are unknowable, and read-back falls back to stripping the prompt.
    choices: { ...(save.choices ?? {}) },
  };
}
