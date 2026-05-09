import { z } from 'zod';

export const DayConfig = z.object({
  day: z.number().int().positive(),
  route: z.string().min(1),
  segments: z.array(z.string().min(1)).min(1), // segment IDs in order
});

export type DayConfig = z.infer<typeof DayConfig>;
