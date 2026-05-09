import { z } from 'zod';
import { CharacterConfig } from './character';
import { CounterConfig } from './counter';

export const GameConfig = z.object({
  axes: z.array(z.string().min(1)).min(1),  // valid affinity axis names
  characters: z.array(CharacterConfig).min(1),
  counters: z.array(CounterConfig).default([]),
});

export type GameConfig = z.infer<typeof GameConfig>;
