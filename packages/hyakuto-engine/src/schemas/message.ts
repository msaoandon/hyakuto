import { z } from 'zod';

// Placeholder — Phase 1 builds the real schema
export const MessageDef = z.object({
  id: z.string(),
});

export type MessageDef = z.infer<typeof MessageDef>;
