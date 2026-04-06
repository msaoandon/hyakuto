import { z } from 'zod';

// A regular dialogue message
const MessageNode = z.object({
  id: z.string(),
  type: z.literal('message'),
  character: z.string(),
  text: z.string(),
  delay_ms: z.number().default(0),
  typing_ms: z.number().default(1000),
  next: z.string().optional(), // explicit jump; if absent, use array successor
});

// A choice (player input pause)
const ChoiceNode = z.object({
  id: z.string(),
  type: z.literal('choice'),
  prompt: z.string(),
  options: z.array(z.object({
    id: z.string(),
    text: z.string(),
    next: z.string() // choices always require an explicit target
  })),
});

export const DialogueItemNode = z.discriminatedUnion('type', [
  ChoiceNode,
  MessageNode,
]);

export const StoryFile = z.object({
  segment: z.string(),
  messages: z.array(DialogueItemNode),
});

export type DialogueItemNode = z.infer<typeof DialogueItemNode>;
export type StoryFile = z.infer<typeof StoryFile>;
export type ChoiceNode = z.infer<typeof ChoiceNode>;
export type MessageNode = z.infer<typeof MessageNode>;