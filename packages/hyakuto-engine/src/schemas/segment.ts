import { z } from 'zod';
import { MessageDef } from './message';

const ChoiceOption = z.object({
  text: z.string().min(1),
  condition: z.string().optional(),
  effects: z.array(z.object({
    axis: z.string().min(1),
    delta: z.number().int(),
  })).optional(),
});

const SegmentType = z.enum(['group_chat', 'dm', 'vn', 'system']);

export const SegmentDef = z.object({
  id: z.string().min(1),
  type: SegmentType,
  route: z.string().optional(),
  day: z.number().int().positive().optional(),
  thread_id: z.string().optional(),
  characters_present: z.array(z.string()).optional(),
  condition: z.string().optional(),
  scene: z.string().optional(),
  messages: z.array(MessageDef),
  choices: z.record(z.string(), z.array(ChoiceOption)).optional(),
});

export type SegmentDef = z.infer<typeof SegmentDef>;
