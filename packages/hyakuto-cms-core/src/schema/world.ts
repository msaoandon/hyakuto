import { z } from 'zod';

// ─── WORLD CONFIG (§VI.2) ─────────────────────────────────────────────────────
// The single authored source for the game's dimensions. It *generates* the
// engine's `gameConfig` (axes + characters + counters) at compile — so the config
// can never drift from the content the way the hand-maintained gameConfig did —
// and it drives every dropdown in the authoring UI (character pickers, axis
// pickers, cue channels, scenes), which is what makes `ko`-vs-`kou` typos
// unrepresentable. Flags / cue channels / scenes / music themes are declared here
// too: the engine doesn't consume them directly, but the CMS validates every
// content reference against these lists.

export const CharacterDef = z.object({
  id: z.string().min(1),
  /** Optional author-facing label; the engine keys on id, not this. */
  display: z.string().optional(),
  typing_rate: z.number().positive().default(1),
});

export const AxisDef = z.object({ id: z.string().min(1) });

const CounterTier = z.object({ name: z.string().min(1), value: z.number() });

export const CounterDef = z.object({
  id: z.string().min(1),
  start: z.number(),
  end: z.number(),
  direction: z.enum(['up', 'down']),
  tiers: z.array(CounterTier).optional(),
  on_complete: z.string().optional(),
});

export const FlagDef = z.object({ id: z.string().min(1) });
export const CueChannelDef = z.object({ id: z.string().min(1) });
export const SceneDef = z.object({ id: z.string().min(1), file: z.string().optional() });
export const MusicThemeDef = z.object({
  id: z.string().min(1),
  /** Author-facing track name; distinct from the id used in content refs (ost / music cue). */
  name: z.string().optional(),
  /** Uploaded audio file (relative to the assets dir). Populated by the upload step. */
  file: z.string().optional(),
});

// The cue channels the engine/content layer understands today (see
// @hyakuto/content CUE_CHANNELS). Declared as the schema default so the model is
// complete out of the box, and configurable-ready for when channels become data.
export const DEFAULT_CUE_CHANNELS: z.infer<typeof CueChannelDef>[] = [
  { id: 'music' },
  { id: 'glitch' },
  { id: 'scene' },
];

export const WorldConfig = z.object({
  characters: z.array(CharacterDef).default([]),
  axes: z.array(AxisDef).default([]),
  counters: z.array(CounterDef).default([]),
  flags: z.array(FlagDef).default([]),
  cueChannels: z.array(CueChannelDef).default(DEFAULT_CUE_CHANNELS),
  scenes: z.array(SceneDef).default([]),
  musicThemes: z.array(MusicThemeDef).default([]),
});

export type CharacterDef = z.infer<typeof CharacterDef>;
export type AxisDef = z.infer<typeof AxisDef>;
export type CounterDef = z.infer<typeof CounterDef>;
export type FlagDef = z.infer<typeof FlagDef>;
export type SceneDef = z.infer<typeof SceneDef>;
export type MusicThemeDef = z.infer<typeof MusicThemeDef>;
export type WorldConfig = z.infer<typeof WorldConfig>;
