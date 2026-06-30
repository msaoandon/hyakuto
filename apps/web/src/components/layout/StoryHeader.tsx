"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CandleMeter } from "./CandleMeter";

/**
 * Shared top bar for Story (ongoing-game) screens: a back/home affordance, a
 * title, the persistent candle count, and an optional right-side slot (e.g. the
 * Timeline button). Every Story route renders through this, so the candle shows
 * on all of them — hub, chat list, chat, VN, DMs, profiles — without per-page
 * wiring. Players and lists own their header so each route can vary the rest.
 */
export function StoryHeader({
  back,
  title,
  backGlyph = "←",
  right,
}: {
  back: string;
  title: ReactNode;
  backGlyph?: string;
  right?: ReactNode;
}) {
  return (
    <header className="shrink-0 text-lantern-blue px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] flex items-center gap-3 bg-black/30">
      <Link href={back} aria-label="back" className="text-xl leading-none">
        {backGlyph}
      </Link>
      <span className="flex-1 truncate">{title}</span>
      <CandleMeter />
      {right}
    </header>
  );
}
