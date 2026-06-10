import type { GameConfig } from "./schemas/game-config";
import type { DayConfig } from "./schemas/day"
import type { CharacterConfig } from "./schemas/character";
import {
  createGameState,
  applyEffect,
  setFlag,
  updateCounter,
  type GameState,
} from "./state/game-state";
import { resolveQueue, type QueuedMessage, type RawMessage } from "./queue/message-queue";
import type { PaceLevel } from "./queue/timing";
import { evaluateCondition } from "./conditions/parser";

// ─── EVENTS ──────────────────────────────────────────────

export type EngineEvent =
  | { type: "message_shown"; message: QueuedMessage }
  | { type: "choice_required"; options: ChoiceOption[]; character?: string }
  | { type: "counter_changed"; counterId: string; value: number; tier?: string }
  | { type: "flag_set"; flag: string }
  | { type: "affinity_changed"; axis: string; value: number }
  | { type: "segment_complete"; segmentId: string }
  | { type: "typing_start"; character: string; duration: number }
  | { type: "typing_end"; character: string }
  | { type: "cue"; channel: string; value: string }
  | { type: "day_complete"; day: number }
  | { type: "segment_skipped"; segmentId: string }
  | { type: "segment_start"; segmentId: string };

export interface ChoiceOption {
  text: string;
  condition?: string;
  effects?: { axis: string; delta: number }[];
}

export interface SegmentInput {
  id: string;
  condition?: string;
  messages: RawMessage[];
  choices?: Record<string, { character?: string; options: ChoiceOption[] }>;
}

type EventHandler = (event: EngineEvent) => void;

// ─── ENGINE ──────────────────────────────────────────────

export interface Engine {
  loadSegment(segment: SegmentInput): void;
  play(): Promise<void>;
  loadDay(day: DayConfig, segments: Record<string, SegmentInput>): void;  // ← add
  playDay(): Promise<void>;                                               // ← add
  chooseOption(index: number): void;
  setPace(pace: PaceLevel): void;
  getState(): GameState;
  getPace(): PaceLevel;
  serialize(): SaveState;
  getCounterStart(counterId: string): number;
}

export interface SaveState {
  axes: Record<string, number>;
  counters: Record<string, number>;
  flags: string[];
  poolSelections: Record<string, number>;
}

export interface CreateEngineOptions {
  config: GameConfig;
  flagsManifest?: string[];
  onEvent: EventHandler;
  savedState?: SaveState;
}

export function createEngine(options: CreateEngineOptions): Engine {
  const { config, flagsManifest = [], onEvent } = options;

  // Restore or create fresh state
  let state: GameState;
  if (options.savedState) {
    state = {
      axes: { ...options.savedState.axes },
      counters: { ...options.savedState.counters },
      flags: new Set(options.savedState.flags),
      poolSelections: { ...options.savedState.poolSelections },
    };
  } else {
    state = createGameState(config);
  }

  let pace: PaceLevel = 1.0;
  let currentSegment: SegmentInput | null = null;
  let currentDay: DayConfig | null = null;
  let segmentsById: Record<string, SegmentInput> = {};
  let queue: QueuedMessage[] = [];
  let waitingForChoice: ((index: number) => void) | null = null;

  function applyMessageEffects(msg: QueuedMessage): void {
    if (msg.effects) {
      for (const effect of msg.effects) {
        // Try axis first, then counter
        if (config.axes.includes(effect.axis)) {
          applyEffect(state, effect.axis, effect.delta, config.axes);
          onEvent({
            type: "affinity_changed",
            axis: effect.axis,
            value: state.axes[effect.axis] ?? 0,
          });
        } else if (effect.axis in state.counters) {
          const newValue = updateCounter(state, effect.axis, effect.delta);
          // Find tier if applicable
          const counterConfig = config.counters.find((c) => c.id === effect.axis);
          const tier = counterConfig?.tiers?.find((t) => {
            if (counterConfig.direction === "down") return newValue <= t.value;
            return newValue >= t.value;
          });
          onEvent({
            type: "counter_changed",
            counterId: effect.axis,
            value: newValue,
            tier: tier?.name,
          });
        } else {
          throw new Error(`Unknown axis or counter: "${effect.axis}"`);
        }
      }
    }

    if (msg.set_flag) {
      setFlag(state, msg.set_flag, flagsManifest);
      onEvent({ type: "flag_set", flag: msg.set_flag });
    }
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  const engine: Engine = {
    loadSegment(segment: SegmentInput): void {
      currentSegment = segment;
      queue = resolveQueue(segment.messages, state, config.characters, pace);
    },

    loadDay(day: DayConfig, segments: Record<string, SegmentInput>): void {
      currentDay = day;
      segmentsById = segments;
    },

    getCounterStart(counterId: string): number {
      const counter = config.counters.find((c) => c.id === counterId);
      if (!counter) throw new Error(`Unknown counter: "${counterId}"`);
      return counter.start;
    },

    async play(): Promise<void> {
      if (!currentSegment) {
        throw new Error("No segment loaded. Call loadSegment() first.");
      }
      
      onEvent({ type: "segment_start", segmentId: currentSegment.id });

      for (const item of queue) {
        if (item.kind === "cue") {
          onEvent({ type: "cue", channel: item.channel!, value: item.value! });
          continue;
        }

        // Delay before typing
        if (item.delay_ms > 0) {
          await sleep(item.delay_ms);
        }

        // Typing indicator
        if (item.typing_ms > 0) {
          onEvent({ type: "typing_start", character: item.character, duration: item.typing_ms });
          await sleep(item.typing_ms);
          onEvent({ type: "typing_end", character: item.character });
        }

        // Show message
        onEvent({ type: "message_shown", message: item });
        applyMessageEffects(item);

        // Check if a choice point follows this message
        if (currentSegment.choices && currentSegment.choices[item.id]) {
          const choiceBlock = currentSegment.choices[item.id];
          const allOptions = choiceBlock.options;

          // Filter options by condition
          const availableOptions = allOptions.filter((opt) => {
            if (!opt.condition) return true;
            return evaluateCondition(opt.condition, state);
          });

          if (availableOptions.length === 0) {
            // All options filtered out — skip the choice
            continue;
          }

          onEvent({
            type: "choice_required",
            options: availableOptions,
            character: choiceBlock.character,
          });

          const chosenIndex = await new Promise<number>((resolve) => {
            waitingForChoice = resolve;
          });

          const chosen = availableOptions[chosenIndex];
          if (chosen?.effects) {
            for (const effect of chosen.effects) {
              if (config.axes.includes(effect.axis)) {
                applyEffect(state, effect.axis, effect.delta, config.axes);
                onEvent({
                  type: "affinity_changed",
                  axis: effect.axis,
                  value: state.axes[effect.axis] ?? 0,
                });
              } else if (effect.axis in state.counters) {
                const newValue = updateCounter(state, effect.axis, effect.delta);
                const counterConfig = config.counters.find((c) => c.id === effect.axis);
                const tier = counterConfig?.tiers?.find((t) => {
                  if (counterConfig.direction === "down") return newValue <= t.value;
                  return newValue >= t.value;
                });
                onEvent({
                  type: "counter_changed",
                  counterId: effect.axis,
                  value: newValue,
                  tier: tier?.name,
                });
              }
            }
          }
        }
      }

      onEvent({ type: "segment_complete", segmentId: currentSegment.id });
    },

    async playDay(): Promise<void> {
      if (!currentDay) throw new Error("No day loaded. Call loadDay() first.");
      for (const segId of currentDay.segments) {
        const segment = segmentsById[segId];
        if (!segment) throw new Error(`Day references unknown segment: "${segId}"`);

        // ── GATING ── evaluate against *current* state, in order
        if (segment.condition && !evaluateCondition(segment.condition, state)) {
          onEvent({ type: "segment_skipped", segmentId: segId });
          continue; // skip; loop advances automatically
        }

        // ── TRANSITION ── load + play; play() emits segment_complete
        engine.loadSegment(segment);
        await engine.play();
      }
      onEvent({ type: "day_complete", day: currentDay.day });
    },

    chooseOption(index: number): void {
      if (!waitingForChoice) {
        throw new Error("No choice is pending.");
      }
      waitingForChoice(index);
      waitingForChoice = null;
    },

    setPace(newPace: PaceLevel): void {
      pace = newPace;
    },

    getPace(): PaceLevel {
      return pace;
    },

    getState(): GameState {
      return state;
    },

    serialize(): SaveState {
      return {
        axes: { ...state.axes },
        counters: { ...state.counters },
        flags: Array.from(state.flags),
        poolSelections: { ...state.poolSelections },
      };
    },
  };

  return engine;
}
