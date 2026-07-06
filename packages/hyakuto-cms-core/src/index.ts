// @hyakuto/cms-core — the authoring/project model + compiler + store.
//
// Layer: depends on @hyakuto/engine (types/schemas for the delivery contract it
// compiles to). Nothing the player app ships depends on this package — the CMS
// compiles *to* the engine's JSON, never coupling at runtime (DEV_PLAN_CMS §VIII).

// ── Project schema (the normalized source of truth) ──
export {
  Project, Workspace, Day, Segment, Thread, ThreadKind, Line, EffectRef, BranchRef,
  CURRENT_SCHEMA_VERSION, migrateProject,
} from './schema/project';
export type {
  Project as ProjectT, Workspace as WorkspaceT, Day as DayT, Segment as SegmentT,
  Thread as ThreadT, Line as LineT,
} from './schema/project';

export {
  WorldConfig, CharacterDef, AxisDef, CounterDef, FlagDef, SceneDef, MusicThemeDef, DEFAULT_CUE_CHANNELS,
} from './schema/world';
export type { WorldConfig as WorldConfigT, MusicThemeDef as MusicThemeDefT } from './schema/world';

export {
  TranslatableUnit, LocaleCode, compileLocalized, unitFromLocalized, newUnit, editUnitText,
} from './schema/translatable';
export type { TranslatableUnit as TranslatableUnitT } from './schema/translatable';

// ── Managed ids (§III.2 — the CMS assigns ids, authors never type them) ──
export { slugifyId, uniqueId, nextLineId, nextChildId } from './ids';

// ── Compile (project → engine delivery contract) ──
export { compile, compileGameConfig, branchPredicate, combineGate, type CompiledContent } from './compile';

// ── Store — NOT re-exported here. The store is node-only (node:fs); it lives at
// the `@hyakuto/cms-core/store` subpath so this entry stays isomorphic and client
// components (the authoring grid) can import model helpers without dragging
// node:fs into the browser bundle.

// ── Import (one-time migration from today's delivery artifacts) ──
export { importProject, type ImportInput } from './import';
