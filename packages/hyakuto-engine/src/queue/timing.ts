// Auto-timing constants from the engine spec
const BASE_TYPING_MS = 500;
const CHAR_RATE_MS = 30; // ms per character
const MAX_TYPING_MS = 4000;
const BASE_DELAY_MS = 1200;

/** A delay multiplier applied to all timing. 0 skips every wait, 1 plays the
 *  authored/auto timing as-is, >1 slows down, <1 speeds up. The app maps its
 *  player-facing speed scale onto this; the engine just multiplies. */
export type PaceLevel = number;

export function calculateTypingMs(
  text: string,
  characterRate: number,
  pace: PaceLevel,
): number {
  if (pace === 0) return 0;
  const raw = BASE_TYPING_MS + CHAR_RATE_MS * text.length;
  const clamped = Math.min(raw, MAX_TYPING_MS);
  return Math.round(clamped * characterRate * pace);
}

export function calculateDelayMs(
  isFirstInGroup: boolean,
  pace: PaceLevel,
): number {
  if (pace === 0) return 0;
  const raw = isFirstInGroup ? BASE_DELAY_MS : BASE_DELAY_MS * 0.5;
  return Math.round(raw * pace);
}
