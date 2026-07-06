import {
  StoryFile, GameConfig, parseManifest,
  type Block, type BlockItem, type Manifest, type GameConfig as GameConfigT,
} from '@hyakuto/engine';
import { compileLocalized } from './schema/translatable';
import type { EffectRef, BranchRef, Line, Project, Segment, Thread } from './schema/project';
import type { WorldConfig } from './schema/world';

// ─── COMPILER (§VI.1/6) ───────────────────────────────────────────────────────
// Projects the normalized project onto the engine's *existing* delivery contract:
// StoryFile blocks + Manifest + gameConfig. This replaces the Apps Script
// exporter, porting its rules (buildCondition, localized, if_/do_ → effects) into
// testable TS. It is a pure function of the project — no I/O — and it fails fast:
// the output is parsed back through the engine schemas before return, so compile
// can never emit content the engine would reject.

export interface CompiledContent {
  blocks: Block[];
  manifest: Manifest;
  gameConfig: GameConfigT;
}

/** A branch relationship → the engine's choice predicate. Inert until the engine
 *  `choice:` predicate lands (DEV_PLAN_CMS §VI "Engine prerequisite"); the compiler
 *  and its tests are ready so that slice lights branches up with no CMS change. */
export function branchPredicate(b: BranchRef): string {
  return `choice:${b.choiceId}==${b.optionId}`;
}

/** AND a freeform condition with a branch predicate into one clause. A single
 *  clause passes through verbatim (so `(tatsumi>0)` round-trips exactly); multiple
 *  clauses are each parenthesised, mirroring the exporter's `buildCondition`. */
export function combineGate(condition?: string, branch?: BranchRef): string | undefined {
  const clauses = [condition, branch && branchPredicate(branch)]
    .filter((c): c is string => !!c && c.trim().length > 0);
  if (clauses.length === 0) return undefined;
  if (clauses.length === 1) return clauses[0];
  return clauses.map((c) => `(${c})`).join(' AND ');
}

function compileEffects(effects: EffectRef[] | undefined): { axis: string; delta: number }[] | undefined {
  if (!effects || effects.length === 0) return undefined;
  return effects.map((e) => ({ axis: e.target, delta: e.delta }));
}

// Set a key only when the value is present, so compiled items match the exporter's
// minimal shape (no `condition: undefined` noise) and round-trip cleanly.
function put<T extends object>(obj: T, key: string, value: unknown): T {
  if (value !== undefined) (obj as Record<string, unknown>)[key] = value;
  return obj;
}

function lineToItem(line: Line, defaultLocale: string): BlockItem {
  switch (line.type) {
    case 'status': {
      const item = { type: 'status', text: compileLocalized(line.text, defaultLocale) };
      return put(item, 'condition', combineGate(line.condition, line.branch)) as BlockItem;
    }
    case 'message': {
      const item = { type: 'message', character: line.character, messages: [compileLocalized(line.text, defaultLocale)] };
      put(item, 'condition', combineGate(line.condition, line.branch));
      return put(item, 'effects', compileEffects(line.effects)) as BlockItem;
    }
    case 'sticker':
    case 'image': {
      const item = { type: line.type, character: line.character, file: line.file };
      put(item, 'condition', combineGate(line.condition, line.branch));
      return put(item, 'effects', compileEffects(line.effects)) as BlockItem;
    }
    case 'pool': {
      const item = {
        type: 'pool',
        character: line.character,
        variants: line.variants.map((v) => ({ text: compileLocalized(v.text, defaultLocale), weight: v.weight })),
      };
      put(item, 'condition', combineGate(line.condition, line.branch));
      return put(item, 'effects', compileEffects(line.effects)) as BlockItem;
    }
    case 'choice': {
      // The line id IS the choice id, and option ids ship verbatim — the engine
      // records the pick under them and `choice:` predicates resolve against
      // them, so delivery must carry the authored identity.
      const item = {
        type: 'choice',
        id: line.id,
        options: line.options.map((o) => {
          const opt = { id: o.id, text: compileLocalized(o.text, defaultLocale) };
          put(opt, 'condition', combineGate(o.condition, o.branch));
          put(opt, 'effects', compileEffects(o.effects));
          return put(opt, 'set_flag', o.set_flag);
        }),
      };
      return put(item, 'character', line.character) as BlockItem;
    }
    case 'cue': {
      const item = { type: 'cue', channel: line.channel, value: line.value };
      return put(item, 'condition', combineGate(line.condition, line.branch)) as BlockItem;
    }
    case 'typing':
      return { type: 'typing', character: line.character };
  }
}

/** A segment's render type is derived, never stored: its thread's kind, or
 *  `system` when it belongs to no thread. Structurally single-kind per thread. */
function segmentType(segment: Segment, threadsById: Map<string, Thread>): Manifest['segments'][string]['type'] {
  if (!segment.threadId) return 'system';
  const thread = threadsById.get(segment.threadId);
  if (!thread) throw new Error(`Segment "${segment.id}" references unknown thread "${segment.threadId}"`);
  return thread.kind;
}

/**
 * Generate the engine's `gameConfig` from the world config. The single projection
 * shared by compile() and the CMS world-editor's live preview — so what the editor
 * shows and what ships can never diverge. Fails fast via `GameConfig.parse`.
 */
export function compileGameConfig(world: WorldConfig): GameConfigT {
  const gameConfig: unknown = {
    axes: world.axes.map((a) => a.id),
    characters: world.characters.map((c) => ({ id: c.id, typing_rate: c.typing_rate })),
    counters: world.counters.map((c) => {
      const out = put({ id: c.id, start: c.start, end: c.end, direction: c.direction }, 'tiers', c.tiers);
      return put(out, 'on_complete', c.on_complete);
    }),
    // Declared flags ship in gameConfig: the engine's set_flag allowlist and the
    // validator's flag-typo net both read from here. Omitted when empty (minimal
    // shape, and configs predating flags stay byte-identical).
    ...(world.flags.length ? { flags: world.flags.map((f) => f.id) } : {}),
  };
  return GameConfig.parse(gameConfig);
}

export function compile(project: Project): CompiledContent {
  const { defaultLocale } = project.workspace;
  const threadsById = new Map(project.threads.map((t) => [t.id, t]));

  // Segment → its owning day's route/index (segments derive these from membership).
  const dayOf = new Map<string, { day: number; route: string }>();
  for (const day of project.days)
    for (const segId of day.segmentIds) dayOf.set(segId, { day: day.index, route: day.route });

  // ── manifest ──
  const days = project.days.map((d) => ({ day: d.index, route: d.route, segments: [...d.segmentIds] }));

  const segments: Record<string, unknown> = {};
  for (const segment of project.segments) {
    const meta: Record<string, unknown> = { id: segment.id, type: segmentType(segment, threadsById) };
    const loc = dayOf.get(segment.id);
    put(meta, 'route', loc?.route);
    put(meta, 'day', loc?.day);
    put(meta, 'thread_id', segment.threadId);
    put(meta, 'scene', segment.scene);
    put(meta, 'condition', combineGate(segment.condition, segment.branch));
    segments[segment.id] = meta;
  }

  const threads: Record<string, unknown> = {};
  for (const thread of project.threads) {
    const meta: Record<string, unknown> = { display_name: compileLocalized(thread.display_name, defaultLocale) };
    put(meta, 'condition', thread.condition);
    put(meta, 'ost', thread.ost);
    put(meta, 'unlock_after', thread.unlock_after);
    put(meta, 'requires', thread.requires);
    put(meta, 'contact', thread.contact);
    threads[thread.id] = meta;
  }

  const manifest: unknown = { days, segments, threads };

  // ── blocks ── one per segment that has content.
  const blocks: unknown[] = project.segments
    .filter((s) => s.lines.length > 0)
    .map((s) => ({ block_id: s.id, items: s.lines.map((l) => lineToItem(l, defaultLocale)) }));

  // Fail fast at the boundary: re-parse our own output through the engine's
  // schemas. compile can never hand the engine content it would reject.
  return {
    blocks: StoryFile.parse(blocks),
    manifest: parseManifest(manifest),
    gameConfig: compileGameConfig(project.world),
  };
}
