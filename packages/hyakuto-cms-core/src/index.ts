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
  WorldConfig, CharacterDef, AxisDef, CounterDef, FlagDef, SceneDef, DEFAULT_CUE_CHANNELS,
} from './schema/world';
export type { WorldConfig as WorldConfigT } from './schema/world';

export { TranslatableUnit, LocaleCode, compileLocalized, unitFromLocalized } from './schema/translatable';
export type { TranslatableUnit as TranslatableUnitT } from './schema/translatable';

// ── Compile (project → engine delivery contract) ──
export { compile, compileGameConfig, branchPredicate, combineGate, type CompiledContent } from './compile';

// ── Store (the file/DB seam) ──
export { FileProjectStore, type ProjectStore } from './store';

// ── Import (one-time migration from today's delivery artifacts) ──
export { importProject, type ImportInput } from './import';
