// Data wiring only: bind the app-bundled content + manifest to the engine's
// headless navigation/assembly logic. All game logic lives in @hyakuto/engine.
import type { StoryFile, GameState, Manifest } from "@hyakuto/engine";
import {
  assembleThread as assemble,
  listDays as days,
  listThreads as threads,
  isThreadUnlocked as unlocked,
  nextUnlockAt as unlockAt,
  currentDay as curDay,
  dayStatus as dayStat,
  listDMs as dms,
  assembleDM as assembleDmThread,
  availableDmSegments as availDmSegs,
  type DayStatus,
  type DmEntry,
} from "@hyakuto/engine";
import manifestData from "./manifest.json";
import demoData from "./demo.json";

export type { Manifest } from "@hyakuto/engine";

export const manifest = manifestData as Manifest;
export const content = demoData as StoryFile;

export const assembleThread = (day: number, threadId: string, state: GameState) =>
  assemble(manifest, content, day, threadId, state);

export const listDays = () => days(manifest);

export const listThreads = (day: number) => threads(manifest, day);

export const isThreadUnlocked = (day: number, threadId: string, state: GameState, now: number) =>
  unlocked(manifest, day, threadId, state, now);

export const nextUnlockAt = (day: number, threadId: string, state: GameState, now: number) =>
  unlockAt(manifest, day, threadId, state, now);

export const currentDay = (state: GameState) => curDay(manifest, state);

export const dayStatus = (day: number, state: GameState): DayStatus => dayStat(manifest, day, state);

export const listDMs = (state: GameState) => dms(manifest, state);

export const assembleDM = (threadId: string, state: GameState, segmentIds?: string[]) =>
  assembleDmThread(manifest, content, threadId, state, segmentIds);

export const availableDmSegments = (threadId: string, state: GameState) =>
  availDmSegs(manifest, threadId, state);

// All DM thread ids (state-independent) — for build-time static params.
const NO_STATE: GameState = {
  axes: {},
  counters: {},
  flags: new Set(),
  poolSelections: {},
  completed: {},
};
export const dmThreadIds = () => dms(manifest, NO_STATE).map((d) => d.id);

export type { DayStatus, DmEntry };

export { stripEffects, stripChoices } from "@hyakuto/engine";
