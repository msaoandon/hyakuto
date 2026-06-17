import { create } from "zustand";
import { createGameState, type SaveState, type GameState } from "@hyakuto/engine";
import { gameConfig } from "@hyakuto/game";

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
  commit: (save: SaveState) => void;
  reset: () => void;
};

export const useGameStore = create<GameStore>()((set) => ({
  save: freshSave(),
  commit: (save) => set({ save }),
  reset: () => set({ save: freshSave() }),
}));

export function saveToState(save: SaveState): GameState {
  return {
    axes: { ...save.axes },
    counters: { ...save.counters },
    flags: new Set(save.flags),
    poolSelections: { ...save.poolSelections },
  };
}

