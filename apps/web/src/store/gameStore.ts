import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createGameState, type SaveState, type GameState } from "@hyakuto/engine";
import { gameConfig } from "@hyakuto/game";
import { type Locale, DEFAULT_LOCALE } from "@/i18n/locales";
import { idbStorage } from "./idbStorage";

function freshSave(): SaveState {
  const s = createGameState(gameConfig);
  return {
    axes: s.axes,
    counters: s.counters,
    flags: [...s.flags],
    poolSelections: s.poolSelections,
  };
}

type GameStore = {
  save: SaveState;
  locale: Locale;
  /** Completed thread key (`day:thread_id`) -> completion time (epoch ms). The
   *  timestamp anchors time-gated unlocks, so completion records *when*, not just *whether*. */
  completed: Record<string, number>;
  /** Active cue value per channel during chat playback (transient — not persisted). */
  cues: Record<string, string>;
  completeThread: (key: string, save: SaveState) => void;
  reset: () => void;
  setLocale: (locale: Locale) => void;
  setCue: (channel: string, value: string) => void;
  clearCues: () => void;
};

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      save: freshSave(),
      locale: DEFAULT_LOCALE,
      completed: {},
      cues: {},
      completeThread: (key, save) =>
        set((s) =>
          key in s.completed ? {} : { save, completed: { ...s.completed, [key]: Date.now() } },
        ),
      reset: () => set({ save: freshSave(), completed: {} }),
      setLocale: (locale) => set({ locale }),
      setCue: (channel, value) => set((s) => ({ cues: { ...s.cues, [channel]: value } })),
      clearCues: () => set({ cues: {} }),
    }),
    {
      name: "hyakuto-save",
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ save: s.save, locale: s.locale, completed: s.completed }),
      // v0 stored `completed` as a string[] (membership only). v1 needs timestamps to
      // anchor time-gated unlocks; legacy entries get 0 ("completed long ago"), which
      // leaves any successor's time gate already satisfied — the safe direction.
      migrate: (persisted, version) => {
        const s = persisted as { completed?: unknown };
        if (version < 1 && Array.isArray(s.completed)) {
          s.completed = Object.fromEntries((s.completed as string[]).map((k) => [k, 0]));
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
  };
}
