import { z } from 'zod';

const CounterDirection = z.enum(['up', 'down']);

const TierThreshold = z.object({
  name: z.string().min(1),
  value: z.number(),
});

export const CounterConfig = z.object({
  id: z.string().min(1),
  start: z.number(),
  end: z.number(),
  direction: CounterDirection,
  tiers: z.array(TierThreshold).optional(),
  on_complete: z.string().optional(),
});

export type CounterConfig = z.infer<typeof CounterConfig>;
