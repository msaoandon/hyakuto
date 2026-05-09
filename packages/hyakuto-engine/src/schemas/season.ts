import { z } from 'zod';

export const SeasonConfig = z.object({
  id: z.string().min(1),
  routes: z.array(z.string().min(1)).min(1),
  romanceable: z.array(z.string()).default([]),
});

export type SeasonConfig = z.infer<typeof SeasonConfig>;
