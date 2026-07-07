import { z } from 'zod';
import { EffectDef } from './effect';
import { Localized } from '../i18n/localized';

const StatusItem = z.object({
  type: z.literal('status'),
  text: Localized,
  condition: z.string().optional(),
});

const MessageItem = z.object({
  type: z.literal('message'),
  character: z.string(),
  messages: z.array(Localized).min(1),
  condition: z.string().optional(),
  effects: z.array(EffectDef).optional(),
  /** Story flag set when this message shows (declared in gameConfig.flags). */
  set_flag: z.string().min(1).optional(),
});

const StickerItem = z.object({
  type: z.literal('sticker'),
  character: z.string(),
  file: z.string().min(1),
  condition: z.string().optional(),
  effects: z.array(EffectDef).optional(),
});

const ImageItem = z.object({
  type: z.literal('image'),
  character: z.string(),
  file: z.string().min(1),
  condition: z.string().optional(),
  effects: z.array(EffectDef).optional(),
});

const PoolItem = z.object({
  type: z.literal('pool'),
  character: z.string(),
  variants: z.array(z.object({
    text: Localized,
    weight: z.number().positive().default(1),
  })).min(1),
  condition: z.string().optional(),
  effects: z.array(EffectDef).optional(),
});

// Choice/option ids are stable, CMS-assigned identities: `choice:<id>==<optId>`
// references them and the engine records the pick under them. Optional for
// back-compat — legacy (Sheets-era) content has none and simply can't be
// branched on; the content validator enforces uniqueness when present.
const ChoiceItem = z.object({
  type: z.literal('choice'),
  id: z.string().min(1).optional(),
  character: z.string().optional(), // undefined = MC
  options: z.array(z.object({
    id: z.string().min(1).optional(),
    text: Localized,
    condition: z.string().optional(),
    effects: z.array(EffectDef).optional(),
    /** Writer-named consequence: picking this option sets the flag (must be
     *  declared in gameConfig.flags); later content gates via `flag:`. */
    set_flag: z.string().min(1).optional(),
  })).min(1),
});

const CueItem = z.object({
  type: z.literal('cue'),
  channel: z.string(),
  value: z.string(),
  condition: z.string().optional(),
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
  StickerItem,
  ImageItem,
  CueItem
]);

export const Block = z.object({
  block_id: z.string(),
  items: z.array(BlockItem),
});

export const StoryFile = z.array(Block);

export type BlockItem = z.infer<typeof BlockItem>;
export type Block = z.infer<typeof Block>;
export type StoryFile = z.infer<typeof StoryFile>;
