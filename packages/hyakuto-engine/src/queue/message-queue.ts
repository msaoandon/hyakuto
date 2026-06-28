import type { GameState } from "../state/game-state";
import type { CharacterConfig } from "../schemas/character";
import { calculateTypingMs, calculateDelayMs, type PaceLevel } from "./timing";
import { evaluateCondition } from "../conditions/parser";
import { selectFromPool } from "../pools/selector";

export interface QueuedMessage {
  id: string;
  character: string;
  text: string;
  delay_ms: number;
  typing_ms: number;
  effects?: { axis: string; delta: number }[];
  set_flag?: string;
  kind?: "cue";
  channel?: string;
  value?: string;
}

export interface RawMessage {
  id: string;
  character: string;
  text?: string;
  pool?: { idx: number; text: string; weight: number }[];
  delay_ms?: number;
  typing_ms?: number;
  condition?: string;
  effects?: { axis: string; delta: number }[];
  set_flag?: string;
  kind?: "cue";
  channel?: string;
  value?: string;
}

export function resolveQueue(
  messages: RawMessage[],
  state: GameState,
  characters: CharacterConfig[],
  pace: PaceLevel,
): QueuedMessage[] {
  const queue: QueuedMessage[] = [];
  let prevCharacter: string | null = null;

  for (const msg of messages) {
    // Evaluate condition — skip if false
    if (msg.condition) {
      if (!evaluateCondition(msg.condition, state)) {
        continue;
      }
    }

    if (msg.kind === "cue") {
      if (msg.condition && !evaluateCondition(msg.condition, state)) continue;
      queue.push({
        id: msg.id,
        character: "",
        kind: "cue",
        channel: msg.channel,
        value: msg.value,
        text: "",
        delay_ms: 0,
        typing_ms: 0,
      });
      continue;
    }

    // Resolve text — pool or direct
    let text: string;
    if (msg.pool) {
      const variant = selectFromPool(msg.id, msg.pool, state);
      text = variant.text;
    } else if (msg.text === undefined) {
      throw new Error(`Message "${msg.id}" has neither text nor pool`);
    } else if (msg.text.trim() === "") {
      throw new Error(`Message "${msg.id}" has empty text`);
    } else {
      text = msg.text;
    }

    // Look up character typing rate
    const charConfig = characters.find((c) => c.id === msg.character);
    const typingRate = charConfig?.typing_rate ?? 1.0;

    // Calculate timing
    const isFirstInGroup = msg.character !== prevCharacter;
    const delay_ms =
      msg.delay_ms !== undefined
        ? Math.round(msg.delay_ms * pace)
        : calculateDelayMs(isFirstInGroup, pace);
    const typing_ms =
      msg.typing_ms !== undefined
        ? Math.round(msg.typing_ms * typingRate * pace)
        : calculateTypingMs(text, typingRate, pace);

    queue.push({
      id: msg.id,
      character: msg.character,
      text,
      delay_ms,
      typing_ms,
      effects: msg.effects,
      set_flag: msg.set_flag,
    });

    prevCharacter = msg.character;
  }

  return queue;
}
