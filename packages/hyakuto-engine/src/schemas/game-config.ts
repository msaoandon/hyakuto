import { z } from 'zod';
import { CharacterConfig } from './character';
import { CounterConfig } from './counter';

export const GameConfig = z.object({
  axes: z.array(z.string().min(1)).min(1),  // valid affinity axis names
  characters: z.array(CharacterConfig).min(1),
  counters: z.array(CounterConfig).default([]),
  /** Declared story flags — the allowlist `set_flag` and `flag:` are checked
   *  against (engine setFlag throws on an undeclared flag; the content validator
   *  catches it at build time). Optional for configs predating flags. */
  flags: z.array(z.string().min(1)).optional(),
});

export type GameConfig = z.infer<typeof GameConfig>;
