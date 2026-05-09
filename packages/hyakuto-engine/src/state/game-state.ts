import type { GameConfig } from '../schemas/game-config.js';

export type GameState = {
  axes: Record<string, number>;
  counters: Record<string, number>;
  flags: Set<string>;
  poolSelections: Record<string, number>; // messageId -> chosen idx
};

export function createGameState(config: GameConfig): GameState {
  const axes: Record<string, number> = {};
  for (const axis of config.axes) {
    axes[axis] = 0;
  }

  const counters: Record<string, number> = {};
  for (const counter of config.counters) {
    counters[counter.id] = counter.start;
  }

  return {
    axes,
    counters,
    flags: new Set(),
    poolSelections: {},
  };
}

export function applyEffect(state: GameState, axis: string, delta: number, validAxes: string[]): void {
  if (!validAxes.includes(axis)) {
    throw new Error(`Unknown axis: "${axis}". Valid axes: ${validAxes.join(', ')}`);
  }
  state.axes[axis] = (state.axes[axis] ?? 0) + delta;
}

export function setFlag(state: GameState, flag: string, validFlags: string[]): void {
  if (!validFlags.includes(flag)) {
    throw new Error(`Unknown flag: "${flag}". Declared flags: ${validFlags.join(', ')}`);
  }
  state.flags.add(flag);
}

export function updateCounter(state: GameState, counterId: string, delta: number): number {
  if (!(counterId in state.counters)) {
    throw new Error(`Unknown counter: "${counterId}"`);
  }
  state.counters[counterId] += delta;
  return state.counters[counterId];
}
