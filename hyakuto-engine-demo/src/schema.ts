import { z } from 'zod';

// An effect like { axis: "story", delta: 1 }
export const Effect = z.object({
  axis: z.string(),
  delta: z.number().int(),
});
export type Effect = z.infer<typeof Effect>;

// A status event: "{MC} joined the room."
export const StatusItem = z.object({
  type: z.literal('status'),
  text: z.string(),
  condition: z.string().optional(),
});

// A grouped run of messages from one character.
// `messages` always has at least one entry.
export const MessageItem = z.object({
  type: z.literal('message'),
  character: z.string(),
  messages: z.array(z.string()).min(1),
  condition: z.string().optional(),
  effects: z.array(Effect).optional(),
});

// A choice point with N options.
export const ChoiceItem = z.object({
  type: z.literal('choice'),
  options: z.array(
    z.object({
      text: z.string(),
      condition: z.string().optional(),
      effects: z.array(Effect).optional(),
    })
  ).min(1),
});

export const TypingItem = z.object({
  type: z.literal('typing'),
  character: z.string(),
});

export const BlockItem = z.discriminatedUnion('type', [
  StatusItem,
  MessageItem,
  ChoiceItem,
  TypingItem,
]);

export type BlockItem = z.infer<typeof BlockItem>;

export const Block = z.object({
  block_id: z.string(),
  items: z.array(BlockItem),
});
export type Block = z.infer<typeof Block>;

// The exporter produces an array of blocks at the top level.
export const StoryFile = z.array(Block);
export type StoryFile = z.infer<typeof StoryFile>;