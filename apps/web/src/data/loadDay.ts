// Data wiring only: bind the app-bundled content + manifest to the engine's
// headless navigation/assembly logic. All game logic lives in @hyakuto/engine.
import type { StoryFile, GameState, Manifest } from "@hyakuto/engine";
import {
  assembleThread as assemble,
  listDays as days,
  listThreads as threads,
  isThreadUnlocked as unlocked,
  nextUnlockAt as unlockAt,
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

export { stripEffects } from "@hyakuto/engine";
