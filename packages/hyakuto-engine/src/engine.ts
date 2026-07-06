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
import { type MCGender, DEFAULT_GENDER } from "./state/mc";
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
  /** Stable authored id (CMS-assigned) — what a `choice:` predicate references
   *  and what gets recorded into `state.choices`. Optional for legacy content. */
  id?: string;
  text: string;
  condition?: string;
  effects?: { axis: string; delta: number }[];
  /** Writer-named consequence ("remember this pick as…"): set on selection,
   *  gated later via `flag:`. Must be declared in gameConfig.flags. */
  set_flag?: string;
}

export interface SegmentInput {
  id: string;
  condition?: string;
  messages: RawMessage[];
  /** Keyed by the message the choice attaches to; `id` is the *authored* choice
   *  id (optional for legacy content) that pairs with option ids for recording. */
  choices?: Record<string, { id?: string; character?: string; options: ChoiceOption[] }>;
}

type EventHandler = (event: EngineEvent) => void;

// ─── ENGINE ──────────────────────────────────────────────

export interface Engine {
  loadSegment(segment: SegmentInput): void;
  /**
   * Play the loaded segment. In `stepped` mode (VN reader) the loop pauses after
   * each shown message until `advance()` is called, and emits no typing-indicator
   * events (the UI reveals text word-by-word instead). Default mode drips messages
   * on timers with typing indicators (chat).
   */
  play(opts?: { stepped?: boolean }): Promise<void>;
  /** Resolve the pending step in `stepped` mode; no-op if nothing is waiting. */
  advance(): void;
  /** Halt the timed drip before the next message; held until resume(). No-op in
   *  `stepped` mode (which gates on advance() instead). */
  pause(): void;
  /** Resume a paused drip. */
  resume(): void;
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
  /** MC gender-for-address (durable customisation). Optional for back-compat:
   *  a legacy save without it restores as `unset`. */
  gender?: MCGender;
}

export interface CreateEngineOptions {
  config: GameConfig;
  flagsManifest?: string[];
  onEvent: EventHandler;
  savedState?: SaveState;
  /** Clock for context predicates (`if_time`). Injectable so play is
   *  deterministic in tests and a trusted-time source can replace it later;
   *  defaults to the real local clock. */
  now?: () => number;
}

export function createEngine(options: CreateEngineOptions): Engine {
  // Declared flags come from gameConfig (the CMS generates them from the world
  // config); the explicit option remains an override for tests/legacy callers.
  const { config, onEvent, now = Date.now } = options;
  const flagsManifest = options.flagsManifest ?? config.flags ?? [];

  // Restore or create fresh state
  let state: GameState;
  if (options.savedState) {
    state = {
      axes: { ...options.savedState.axes },
      counters: { ...options.savedState.counters },
      flags: new Set(options.savedState.flags),
      poolSelections: { ...options.savedState.poolSelections },
      // Completion is app-managed save state (used for thread-unlock gating, not
      // the play loop); the engine's per-play SaveState doesn't carry it.
      completed: {},
      gender: options.savedState.gender ?? DEFAULT_GENDER,
      // Recorded choices are runtime-only until DEV_PLAN Phase 3 adds them to
      // the save schema — a restored session starts with none recorded.
      choices: {},
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
  // Pause gate: while `paused`, the play loop awaits a resume before the next
  // message. resume() flushes the waiters.
  let paused = false;
  let resumeWaiters: Array<() => void> = [];
  let waitingForAdvance: (() => void) | null = null;

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

  // Resolves immediately unless paused, in which case it waits for resume().
  function waitWhilePaused(): Promise<void> {
    if (!paused) return Promise.resolve();
    return new Promise<void>((resolve) => resumeWaiters.push(resolve));
  }

  const engine: Engine = {
    loadSegment(segment: SegmentInput): void {
      currentSegment = segment;
      // Resolve at base timing (pace 1.0); the pace multiplier is applied live at
      // playback (see play()), so a mid-segment setPace speeds up / slows down the
      // remaining drip instead of being frozen at load time.
      queue = resolveQueue(segment.messages, state, config.characters, 1.0, { now: now() });
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

    async play(opts?: { stepped?: boolean }): Promise<void> {
      if (!currentSegment) {
        throw new Error("No segment loaded. Call loadSegment() first.");
      }
      const stepped = opts?.stepped ?? false;

      onEvent({ type: "segment_start", segmentId: currentSegment.id });

      for (let idx = 0; idx < queue.length; idx++) {
        // Hold here before each item while paused — stops new messages (and the
        // cues/typing that precede them) until resume(). The message already on
        // screen stays; an in-flight one finishes its current iteration first.
        if (!stepped) await waitWhilePaused();

        const item = queue[idx]!;

        // ── GATING (show time) ── the gate sees the state as it is NOW, so a
        // line can branch on a choice or effect from earlier in this same
        // segment — the same "current state, in order" rule playDay applies.
        if (item.condition && !evaluateCondition(item.condition, state, { now: now() })) {
          // A pool variant selected at load for a line that never shows must
          // not count as seen — roll the recording back.
          if (item.poolJustSelected) delete state.poolSelections[item.id];
          continue;
        }

        if (item.kind === "cue") {
          // Cues (incl. the VN `scene` cue) fire immediately — they precede a
          // message and never gate, in either mode.
          onEvent({ type: "cue", channel: item.channel!, value: item.value! });
          continue;
        }

        if (!stepped) {
          // Timed playback: delay, then a typing indicator before the message.
          // Pace is read live here (not baked at load) so a pace change applies to
          // the very next message. Pace 0 (skip) collapses both to no wait.
          const delay = item.delay_ms * pace;
          if (delay > 0) {
            await sleep(delay);
          }
          const typing = item.typing_ms * pace;
          if (typing > 0) {
            onEvent({ type: "typing_start", character: item.character, duration: typing });
            await sleep(typing);
            onEvent({ type: "typing_end", character: item.character });
          }
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
            return evaluateCondition(opt.condition, state, { now: now() });
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
          // Record the pick by stable id (the `choice:` predicate's data) BEFORE
          // applying effects, mirroring how effects land pre-continue. Legacy
          // content without ids simply records nothing.
          if (choiceBlock.id && chosen?.id) {
            state.choices[choiceBlock.id] = chosen.id;
          }
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

          // Writer-named consequence, applied after effects (same order as
          // messages: effects, then flag). Throws on an undeclared flag —
          // the content validator catches that long before runtime.
          if (chosen?.set_flag) {
            setFlag(state, chosen.set_flag, flagsManifest);
            onEvent({ type: "flag_set", flag: chosen.set_flag });
          }

          if (stepped) {
            // After the pick, hold on the player's answer until they advance —
            // but only if more dialogue follows. A choice that ends the thread
            // needs no trailing tap; fall through to segment_complete.
            const moreToCome = queue.slice(idx + 1).some((it) => it.kind !== "cue");
            if (moreToCome) {
              await new Promise<void>((resolve) => {
                waitingForAdvance = resolve;
              });
            }
          }
        } else if (stepped) {
          // VN reader: gate *between* messages — hold here until the player
          // advances, but only if another message still follows. The final
          // message needs no trailing advance (it would be a redundant tap);
          // the loop falls straight through to segment_complete. (Cues don't
          // gate, so a trailing cue doesn't count as "more to come".)
          const moreToCome = queue.slice(idx + 1).some((it) => it.kind !== "cue");
          if (moreToCome) {
            await new Promise<void>((resolve) => {
              waitingForAdvance = resolve;
            });
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
        if (segment.condition && !evaluateCondition(segment.condition, state, { now: now() })) {
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

    advance(): void {
      // No-op when nothing is waiting: the UI may call this during text reveal
      // or after the segment has already completed.
      if (!waitingForAdvance) return;
      const resume = waitingForAdvance;
      waitingForAdvance = null;
      resume();
    },

    pause(): void {
      paused = true;
    },

    resume(): void {
      paused = false;
      const waiters = resumeWaiters;
      resumeWaiters = [];
      for (const w of waiters) w();
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
        gender: state.gender,
      };
    },
  };

  return engine;
}
