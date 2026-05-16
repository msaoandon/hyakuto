import { z } from 'zod';
import { EffectDef } from './effect';

const StatusItem = z.object({
  type: z.literal('status'),
  text: z.string(),
  condition: z.string().optional(),
});

const MessageItem = z.object({
  type: z.literal('message'),
  character: z.string(),
  messages: z.array(z.string()).min(1),
  condition: z.string().optional(),
  effects: z.array(EffectDef).optional(),
});

const PoolItem = z.object({
  type: z.literal('pool'),
  character: z.string(),
  variants: z.array(z.object({
    text: z.string().min(1),
    weight: z.number().positive().default(1),
  })).min(1),
  condition: z.string().optional(),
  effects: z.array(EffectDef).optional(),
});

const ChoiceItem = z.object({
  type: z.literal('choice'),
  character: z.string().optional(), // undefined = MC
  options: z.array(z.object({
    text: z.string(),
    condition: z.string().optional(),
    effects: z.array(EffectDef).optional(),
  })).min(1),
});

const TypingItem = z.object({
  type: z.literal('typing'),
  character: z.string(),
});

export const BlockItem = z.discriminatedUnion('type', [
  StatusItem,
  MessageItem,
  PoolItem,
  ChoiceItem,
  TypingItem,
]);

export const Block = z.object({
  block_id: z.string(),
  items: z.array(BlockItem),
});

export const StoryFile = z.array(Block);

export type BlockItem = z.infer<typeof BlockItem>;
export type Block = z.infer<typeof Block>;
export type StoryFile = z.infer<typeof StoryFile>;
