import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createGameState, type SaveState, type GameState } from "@hyakuto/engine";
import { gameConfig } from "@hyakuto/game";
import { type Locale, DEFAULT_LOCALE } from "@/i18n/locales";

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
  commit: (save: SaveState) => void;
  reset: () => void;
  setLocale: (locale: Locale) => void;
};

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      save: freshSave(),
      locale: DEFAULT_LOCALE,
      commit: (save) => set({ save }),
      reset: () => set({ save: freshSave() }),
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: "hyakuto-save",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ save: s.save, locale: s.locale }),
    },
  ),
);

export function saveToState(save: SaveState): GameState {
  return {
    axes: { ...save.axes },
    counters: { ...save.counters },
    flags: new Set(save.flags),
    poolSelections: { ...save.poolSelections },
  };
}
