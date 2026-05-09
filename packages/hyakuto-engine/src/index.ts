// Schemas
export { EffectDef } from './schemas/effect.js';
export { MessageDef } from './schemas/message.js';
export { SegmentDef } from './schemas/segment.js';
export { DayConfig } from './schemas/day.js';
export { CharacterConfig } from './schemas/character.js';
export { CounterConfig } from './schemas/counter.js';
export { RouteConfig } from './schemas/route.js';
export { SeasonConfig } from './schemas/season.js';
export { GameConfig } from './schemas/game-config.js';

// State
export { createGameState, applyEffect, setFlag, updateCounter } from './state/game-state.js';
export type { GameState } from './state/game-state.js';
