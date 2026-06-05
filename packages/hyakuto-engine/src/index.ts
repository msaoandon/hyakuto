// Schemas
export { EffectDef } from "./schemas/effect";
export { MessageDef } from "./schemas/message";
export { SegmentDef } from "./schemas/segment";
export { DayConfig } from "./schemas/day";
export { CharacterConfig } from "./schemas/character";
export { CounterConfig } from "./schemas/counter";
export { RouteConfig } from "./schemas/route";
export { SeasonConfig } from "./schemas/season";
export { GameConfig } from "./schemas/game-config";
export { Block, BlockItem, StoryFile } from "./schemas/block";

// State
export { createGameState, applyEffect, setFlag, updateCounter } from "./state/game-state";
export type { GameState } from "./state/game-state";

// Parsers
export { parseCondition, evaluateCondition } from "./conditions/parser";
export { collectConditionRefs } from "./conditions/refs";

// Pool message selector
export { selectFromPool, type PoolVariant } from "./pools/selector";

// Queue
export { calculateTypingMs, calculateDelayMs, type PaceLevel } from "./queue/timing";
export { resolveQueue, type QueuedMessage, type RawMessage } from "./queue/message-queue";

// Engine
export {
  createEngine,
  type Engine,
  type EngineEvent,
  type ChoiceOption,
  type SegmentInput,
  type SaveState,
  type CreateEngineOptions,
} from "./engine";
