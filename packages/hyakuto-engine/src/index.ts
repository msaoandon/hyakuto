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

// MC customisation (gender-for-address drives the `if_gender` predicate)
export { MC_GENDERS, DEFAULT_GENDER, isMCGender, type MCGender } from "./state/mc";

// Reserved characters (registered automatically — no game-config entry needed)
export { NARRATOR, RESERVED_CHARACTERS } from "./reserved";

// Parsers
export { parseCondition, evaluateCondition, type RuntimeContext } from "./conditions/parser";
export { collectConditionRefs } from "./conditions/refs";

// Time-of-day bands (drive the `if_time` predicate)
export { TIME_BANDS, bandOf, isTimeBand, type TimeBand } from "./conditions/time";

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

// Manifest navigation + assembly (headless game logic shared by web UI and CLI)
export {
  convertBlockToSegment,
  isSegmentAvailable,
  assembleThread,
  buildDay,
  listDays,
  listThreads,
  stripEffects,
  stripChoices,
  threadKey,
  previousThread,
  nextUnlockAt,
  isThreadUnlocked,
  isDayComplete,
  currentDay,
  dayStatus,
  listDMs,
  assembleDM,
  availableDmSegments,
  dmKey,
  parseManifest,
  type SegmentMeta,
  type ThreadMeta,
  type ThreadKind,
  type ThreadEntry,
  type DayStatus,
  type DmEntry,
  type Manifest,
  type LoadedDay,
} from "./manifest/manifest";


