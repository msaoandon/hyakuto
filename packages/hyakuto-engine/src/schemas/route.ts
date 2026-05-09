import { z } from 'zod';

const EndingCondition = z.object({
  id: z.string().min(1),
  condition: z.string().min(1),
  priority: z.number().int().optional(),
});

export const RouteConfig = z.object({
  id: z.string().min(1),
  counters: z.array(z.string()).optional(),
  flags_manifest: z.array(z.string()).default([]),
  endings: z.array(EndingCondition).optional(),
});

export type RouteConfig = z.infer<typeof RouteConfig>;
