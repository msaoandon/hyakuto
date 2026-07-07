"use client";

import { useGameStore } from "@/store/gameStore";
import { useT } from "@/i18n";

// Pause/resume the chat drip. Holds new messages until resumed (the engine
// gates its play loop); the message already on screen stays. Transient — a new
// thread always starts playing.
export function PauseButton() {
  const paused = useGameStore((s) => s.chatPaused);
  const setChatPaused = useGameStore((s) => s.setChatPaused);
  const t = useT();
  const toggle = () => setChatPaused(!paused);

  return (
    <button
      onClick={toggle}
      aria-pressed={paused}
      aria-label={paused ? t("play.resume") : t("play.pause")}
      className="px-2 py-1 text-sm leading-none rounded bg-ink-black/40 text-beige"
    >
      {paused ? "▶" : "⏸"}
    </button>
  );
}
