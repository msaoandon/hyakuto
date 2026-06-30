"use client";

import { useGameStore } from "@/store/gameStore";

/**
 * The persistent candle count shown in every Story (ongoing-game) header. Reads
 * the committed save's `candles` counter — the durable value, not the mid-play
 * one (live extinguish feedback is the deferred animation's job). Rendered by
 * StoryHeader, so every ongoing-game screen carries it without per-page wiring.
 */
export function CandleMeter() {
  const candles = useGameStore((s) => s.save.counters.candles ?? 0);
  return (
    <span className="shrink-0 tabular-nums text-beige" aria-label={`${candles} candles`}>
      🕯 {candles}
    </span>
  );
}
