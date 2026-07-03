import type { Block, BlockItem, GameConfig, Manifest } from '@hyakuto/engine';
import { unitFromLocalized } from './schema/translatable';
import { CURRENT_SCHEMA_VERSION, Project } from './schema/project';
import type { Day, EffectRef, Line, Segment, Thread, ThreadKind } from './schema/project';
import { DEFAULT_CUE_CHANNELS } from './schema/world';

// ─── IMPORTER (§VI.1) ─────────────────────────────────────────────────────────
// The one-time migration from the existing delivery artifacts (the Apps Script
// export + hand-written gameConfig) into a normalized project — so nothing is
// lost when authoring moves off Sheets. It is the inverse of compile(): running
// compile(importProject(x)) reproduces x (the round-trip that proves both are
// faithful). Ids absent in the source (choice/option/variant ids, translatable
// unit ids) are synthesized deterministically from the owning block so re-import
// is stable; thereafter they are persisted and never recomputed (§III.2).

export interface ImportInput {
  blocks: Block[];
  manifest: Manifest;
  gameConfig: GameConfig;
  workspace?: { id: string; name: string; defaultLocale?: string; locales?: string[] };
}

function effectFromDef(e: { axis: string; delta: number }): EffectRef {
  return { target: e.axis, delta: e.delta };
}

function itemToLine(item: BlockItem, segId: string, index: number, dl: string): Line {
  const id = `${segId}__${index}`;
  switch (item.type) {
    case 'status':
      return { type: 'status', id, text: unitFromLocalized(item.text, id, dl), ...cond(item.condition) };
    case 'message':
      return {
        type: 'message', id, character: item.character,
        text: unitFromLocalized(single(item.messages, id), id, dl),
        ...cond(item.condition), ...fx(item.effects),
      };
    case 'sticker':
    case 'image':
      return { type: item.type, id, character: item.character, file: item.file, ...cond(item.condition), ...fx(item.effects) };
    case 'pool':
      return {
        type: 'pool', id, character: item.character,
        variants: item.variants.map((v, i) => ({ id: `${id}__v${i}`, text: unitFromLocalized(v.text, `${id}__v${i}`, dl), weight: v.weight })),
        ...cond(item.condition), ...fx(item.effects),
      };
    case 'choice':
      return {
        type: 'choice', id,
        ...(item.character ? { character: item.character } : {}),
        options: item.options.map((o, i) => {
          const oid = `${id}__o${i}`;
          return {
            id: oid, text: unitFromLocalized(o.text, oid, dl),
            ...cond(o.condition), ...fx(o.effects),
          };
        }),
      };
    case 'cue':
      return { type: 'cue', id, channel: item.channel, value: item.value, ...cond(item.condition) };
    case 'typing':
      return { type: 'typing', id, character: item.character };
  }
}

const cond = (condition?: string) => (condition ? { condition } : {});
const fx = (effects?: { axis: string; delta: number }[]) =>
  effects && effects.length ? { effects: effects.map(effectFromDef) as EffectRef[] } : {};

// The exporter always emits a single-bubble message; a multi-bubble message is an
// unsupported legacy shape rather than something to silently flatten — fail loud.
function single<T>(messages: T[], id: string): T {
  if (messages.length !== 1)
    throw new Error(`Message "${id}" has ${messages.length} bubbles; the importer expects exactly one`);
  return messages[0];
}

export function importProject(input: ImportInput): Project {
  const defaultLocale = input.workspace?.defaultLocale ?? 'en';

  // Discover the locales actually used across all translatable values.
  const locales = new Set<string>([defaultLocale]);
  const collect = (v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) for (const k of Object.keys(v)) locales.add(k);
  };
  for (const b of input.blocks)
    for (const it of b.items) {
      if (it.type === 'message') it.messages.forEach(collect);
      if (it.type === 'status') collect(it.text);
      if (it.type === 'pool') it.variants.forEach((v) => collect(v.text));
      if (it.type === 'choice') it.options.forEach((o) => collect(o.text));
    }
  for (const t of Object.values(input.manifest.threads)) collect(t.display_name);

  // Thread kind is derived from the type of its segments (all share one, enforced
  // upstream); this is what lets the model drop per-segment `type`.
  const kindByThread = new Map<string, ThreadKind>();
  for (const meta of Object.values(input.manifest.segments))
    if (meta.thread_id && meta.type !== 'system') kindByThread.set(meta.thread_id, meta.type as ThreadKind);

  const threads: Thread[] = Object.entries(input.manifest.threads).map(([id, t]) => {
    const thread: Thread = {
      id, kind: kindByThread.get(id) ?? 'group_chat',
      display_name: unitFromLocalized(t.display_name, `${id}__name`, defaultLocale),
    };
    if (t.condition) thread.condition = t.condition;
    if (t.ost) thread.ost = t.ost;
    if (t.contact) thread.contact = t.contact;
    if (t.unlock_after) thread.unlock_after = t.unlock_after;
    if (t.requires) thread.requires = t.requires;
    return thread;
  });

  const days: Day[] = input.manifest.days.map((d) => ({
    id: `${d.route}__d${d.day}`, index: d.day, route: d.route, segmentIds: [...d.segments],
  }));

  const linesBySegment = new Map<string, Line[]>();
  for (const b of input.blocks) linesBySegment.set(b.block_id, b.items.map((it, i) => itemToLine(it, b.block_id, i, defaultLocale)));

  const segments: Segment[] = Object.values(input.manifest.segments).map((meta) => {
    const segment: Segment = { id: meta.id, lines: linesBySegment.get(meta.id) ?? [] };
    if (meta.thread_id) segment.threadId = meta.thread_id;
    if (meta.scene) segment.scene = meta.scene;
    if (meta.condition) segment.condition = meta.condition;
    return segment;
  });

  // Scenes / music themes are declared in the world for dropdowns + validation;
  // harvest them from the content so the imported world is complete.
  const scenes = new Set<string>();
  const musicThemes = new Set<string>();
  for (const meta of Object.values(input.manifest.segments)) if (meta.scene) scenes.add(meta.scene);
  for (const t of Object.values(input.manifest.threads)) if (t.ost) musicThemes.add(t.ost);
  for (const b of input.blocks)
    for (const it of b.items)
      if (it.type === 'cue') {
        if (it.channel === 'scene' && it.value) scenes.add(it.value);
        if (it.channel === 'music' && it.value) musicThemes.add(it.value);
      }

  const project: Project = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    workspace: {
      id: input.workspace?.id ?? 'default',
      name: input.workspace?.name ?? 'Hyakutō',
      defaultLocale,
      locales: input.workspace?.locales ?? [...locales],
    },
    world: {
      characters: input.gameConfig.characters.map((c) => ({ id: c.id, typing_rate: c.typing_rate })),
      axes: input.gameConfig.axes.map((id) => ({ id })),
      counters: input.gameConfig.counters.map((c) => ({ ...c })),
      flags: [],
      cueChannels: DEFAULT_CUE_CHANNELS,
      scenes: [...scenes].map((id) => ({ id })),
      musicThemes: [...musicThemes].map((id) => ({ id })),
    },
    threads,
    days,
    segments,
  };

  return Project.parse(project);
}
