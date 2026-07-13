import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createGameState, DEFAULT_GENDER, type MCGender, type SaveState, type GameState } from "@hyakuto/engine";
import { gameConfig } from "@hyakuto/game";
import { type Locale, DEFAULT_LOCALE, matchDeviceLocale } from "@/i18n/locales";
import { idbStorage } from "./idbStorage";
import { readMcAvatar, writeMcAvatar, deleteMcAvatar } from "./mcAvatar";

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
      completeThread: (key, save) =>
        set((s) =>
          key in s.completed ? {} : { save, completed: { ...s.completed, [key]: Date.now() } },
        ),
      markDmRead: (threadId, segmentIds) =>
        set((s) => {
          const seen = new Set([...(s.dmRead[threadId] ?? []), ...segmentIds]);
          return { dmRead: { ...s.dmRead, [threadId]: [...seen] } };
        }),
      // A new game = a new identity: MC name/pronouns/avatar belong to the
      // playthrough (and wiping the save wipes the personal data with it).
      reset: () => {
        void deleteMcAvatar();
        set({ save: freshSave(), completed: {}, dmRead: {}, mc: EMPTY_MC, mcChosen: false, mcAvatarUrl: null });
      },
      setMc: ({ gender, ...profile }) =>
        set((s) => ({
          mc: { ...s.mc, ...profile },
          mcChosen: true,
          ...(gender !== undefined ? { save: { ...s.save, gender } } : {}),
        })),
      loadMcAvatar: async () => {
        const blob = await readMcAvatar();
        set({ mcAvatarUrl: blob ? URL.createObjectURL(blob) : null });
      },
      setMcAvatar: async (blob) => {
        // Preview first — the picked photo must show even if persistence fails
        // (e.g. private-mode storage restrictions); it then lasts the session.
        set({ mcAvatarUrl: URL.createObjectURL(blob), mcChosen: true });
        try {
          await writeMcAvatar(blob);
        } catch (err) {
          console.warn("avatar preview only — could not persist:", err);
        }
      },
      clearMcAvatar: async () => {
        await deleteMcAvatar();
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
      version: 3,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        save: s.save,
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
      migrate: (persisted, version) => {
        const s = persisted as { completed?: unknown; localeChosen?: boolean; mc?: McProfile; mcChosen?: boolean };
        if (version < 1 && Array.isArray(s.completed)) {
          s.completed = Object.fromEntries((s.completed as string[]).map((k) => [k, 0]));
        }
        if (version < 2) s.localeChosen = true;
        if (version < 3) {
          s.mc = EMPTY_MC;
          s.mcChosen = true;
        }
        return persisted as GameStore;
      },
      skipHydration: true,
    },
  ),
);

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
