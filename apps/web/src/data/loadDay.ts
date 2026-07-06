// Data wiring only: bind the app-bundled content + manifest to the engine's
// headless navigation/assembly logic. All game logic lives in @hyakuto/engine.
import type { GameState } from "@hyakuto/engine";
import {
  StoryFile,
  parseManifest,
  assembleThread as assemble,
  listDays as days,
  listThreads as threads,
  threadDisplayName as threadName,
  isThreadUnlocked as unlocked,
  nextUnlockAt as unlockAt,
  currentDay as curDay,
  dayStatus as dayStat,
  listDMs as dms,
  assembleDM as assembleDmThread,
  availableDmSegments as availDmSegs,
  DEFAULT_LOCALE,
  type DayStatus,
  type DmEntry,
} from "@hyakuto/engine";
import manifestData from "./manifest.json";
import demoData from "./demo.json";

export type { Manifest } from "@hyakuto/engine";

// Validate the bundled JSON at the load boundary — fail fast and loudly rather
// than blind-cast. This runs at module load, so during `next build` a malformed
// manifest/content file fails the static export instead of misbehaving mid-play.
export const manifest = parseManifest(manifestData);
export const content = StoryFile.parse(demoData);

export const assembleThread = (
  day: number,
  threadId: string,
  state: GameState,
  locale: string = DEFAULT_LOCALE,
) => assemble(manifest, content, day, threadId, state, locale);

export const listDays = () => days(manifest);

export const listThreads = (day: number, locale: string = DEFAULT_LOCALE) =>
  threads(manifest, day, locale);

/** A thread's display name in the active locale (chat/VN/DM headers). */
export const threadDisplayName = (threadId: string, locale: string = DEFAULT_LOCALE) =>
  threadName(manifest, threadId, locale);

export const isThreadUnlocked = (day: number, threadId: string, state: GameState, now: number) =>
  unlocked(manifest, day, threadId, state, now);

export const nextUnlockAt = (day: number, threadId: string, state: GameState, now: number) =>
  unlockAt(manifest, day, threadId, state, now);

export const currentDay = (state: GameState) => curDay(manifest, state);

export const dayStatus = (day: number, state: GameState): DayStatus => dayStat(manifest, day, state);

export const listDMs = (state: GameState, locale: string = DEFAULT_LOCALE) =>
  dms(manifest, state, locale);

export const assembleDM = (
  threadId: string,
  state: GameState,
  segmentIds?: string[],
  locale: string = DEFAULT_LOCALE,
) => assembleDmThread(manifest, content, threadId, state, segmentIds, locale);

export const availableDmSegments = (threadId: string, state: GameState) =>
  availDmSegs(manifest, threadId, state);

// All DM thread ids (state-independent) — for build-time static params.
const NO_STATE: GameState = {
  axes: {},
  counters: {},
  flags: new Set(),
  poolSelections: {},
  completed: {},
  gender: "unset",
  choices: {},
};
export const dmThreadIds = () => dms(manifest, NO_STATE).map((d) => d.id);

export type { DayStatus, DmEntry };

export { stripEffects, stripChoices } from "@hyakuto/engine";
