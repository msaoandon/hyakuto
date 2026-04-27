import { z } from 'zod';

export const SegmentDef = z.object({
  id: z.string(),
});

export type SegmentDef = z.infer<typeof SegmentDef>;
