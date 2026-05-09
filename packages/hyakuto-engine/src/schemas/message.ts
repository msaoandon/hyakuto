import { z } from 'zod';
import { EffectDef } from './effect';

// A single pool variant
const PoolVariant = z.object({
  idx: z.number().int().nonnegative(),
  text: z.string().min(1),
  weight: z.number().positive().default(1),
});

// Standard message — has text directly
const StandardMessage = z.object({
  id: z.string().min(1),
  character: z.string().min(1),
  text: z.string().min(1),
  pool: z.undefined().optional(),
  delay_ms: z.number().int().nonnegative().optional(),
  typing_ms: z.number().int().nonnegative().optional(),
  condition: z.string().optional(),
  effects: z.array(EffectDef).optional(),
  set_flag: z.string().optional(),
});

// Pool message — has pool array instead of text
const PoolMessage = z.object({
  id: z.string().min(1),
  character: z.string().min(1),
  text: z.undefined().optional(),
  pool: z.array(PoolVariant).min(1),
  delay_ms: z.number().int().nonnegative().optional(),
  typing_ms: z.number().int().nonnegative().optional(),
  condition: z.string().optional(),
  effects: z.array(EffectDef).optional(),
  set_flag: z.string().optional(),
});

export const MessageDef = z.union([StandardMessage, PoolMessage]);

export type MessageDef = z.infer<typeof MessageDef>;
