// packages/hyakuto-game/src/config.ts
import type { GameConfig } from '@hyakuto/engine';

export const gameConfig: GameConfig = {
  axes: ['story', 'suspense', 'trust'],
  characters: [
    { id: 'Ao', typing_rate: 1.0 },
    { id: 'Kou', typing_rate: 0.6 },
    { id: 'Haruki', typing_rate: 0.8 },
    { id: 'Tatsumi', typing_rate: 1.4 },
    { id: 'Ren', typing_rate: 1.2 },
    { id: 'Mio', typing_rate: 1.0 },
    { id: 'Kaname', typing_rate: 1.0 },
  ],
  counters: [
    { id: 'candles', start: 67, end: 0, direction: 'down' },
  ],
};
