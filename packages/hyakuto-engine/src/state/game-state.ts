import type { GameConfig } from '../schemas/game-config';
import { type MCGender, DEFAULT_GENDER } from './mc';

export type GameState = {
  axes: Record<string, number>;
  counters: Record<string, number>;
  flags: Set<string>;
  poolSelections: Record<string, number>; // messageId -> chosen idx
  /** Completed thread key (`day:thread_id`) -> completion time (epoch ms). The
   *  timestamp anchors time-gated unlocks, so it must record *when*, not just *whether*. */
  completed: Record<string, number>;
  /** MC gender-for-address, driving the `if_gender` predicate. Defaults to
   *  `unset` (the inclusive baseline) until the Phase 3 customisation picker. */
  gender: MCGender;
  /** choiceId → picked optionId, recorded when MC resolves an id-carrying choice.
   *  Drives the `choice:` predicate. Runtime-only for now: persisting it is
   *  player-state work (DEV_PLAN Phase 3 "record choice history"), so today
   *  branching holds within a session; cross-session lights up with the save. */
  choices: Record<string, string>;
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
    completed: {},
    gender: DEFAULT_GENDER,
    choices: {},
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
