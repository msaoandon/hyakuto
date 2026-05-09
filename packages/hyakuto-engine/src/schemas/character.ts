import { z } from 'zod';

export const CharacterConfig = z.object({
  id: z.string().min(1),
  typing_rate: z.number().positive().default(1.0),
});

export type CharacterConfig = z.infer<typeof CharacterConfig>;
