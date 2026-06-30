"use client";

import {
  useGameStore,
  PACE_LEVEL_MIN,
  PACE_LEVEL_MAX,
} from "@/store/gameStore";
import { useT } from "@/i18n";

// Chat drip-speed control: « slower / » faster around a 1–9 level (5 = default).
// The level is a persisted preference applied live to the running chat (the
// engine reads pace at playback time). « and » step by one and clamp at the ends.
export function PaceControl() {
  const level = useGameStore((s) => s.chatPaceLevel);
  const setChatPaceLevel = useGameStore((s) => s.setChatPaceLevel);
  const t = useT();

  // « decreases speed (slower), » increases speed (faster).
  const step = (delta: number) => () => setChatPaceLevel(level + delta);
  const btn =
    "px-2 py-1 text-sm leading-none rounded text-beige disabled:opacity-30 disabled:cursor-default";

  return (
    <div className="flex items-center gap-1 rounded bg-ink-black/40 px-1">
      <button onClick={step(-1)} disabled={level <= PACE_LEVEL_MIN} aria-label={t("play.slower")} className={btn}>
        «
      </button>
      <span aria-label={`${t("play.speed")}: ${level}`} className="min-w-4 text-center text-sm tabular-nums text-beige">
        {level}
      </span>
      <button onClick={step(1)} disabled={level >= PACE_LEVEL_MAX} aria-label={t("play.faster")} className={btn}>
        »
      </button>
    </div>
  );
}
