import { z } from 'zod';

export const EffectDef = z.object({
  axis: z.string().min(1),
  delta: z.number().int(),
});

export type EffectDef = z.infer<typeof EffectDef>;
