"use client";

import Link from "next/link";
import { useMemo } from "react";
import { gameConfig } from "@hyakuto/game";
import { Avatar } from "@/components/chat/Avatar";
import { StoryHeader } from "@/components/layout/StoryHeader";
import { LanternBackground } from "@/components/LanternBackground";
import { currentDay } from "@/data/loadDay";
import { useGameStore, saveToState } from "@/store/gameStore";
import { useT } from "@/i18n";

// The active-game hub: cast avatars up top, then the two doors (Chat / DMs).
// Participants are not a destination — just the avatar row. The current day is
// derived, so Chat always opens where the player actually is.
export default function StoryHubPage() {
  const t = useT();
  const save = useGameStore((s) => s.save);
  const completed = useGameStore((s) => s.completed);

  const day = useMemo(() => currentDay(saveToState(save, completed)), [save, completed]);
  const candles = save.counters.candles ?? 0;

  return (
    <>
      <StoryHeader
        back="/lobby"
        backGlyph="☰"
        title={
          <span>
            {t("play.day", { n: day })} · 🕯 {candles}
          </span>
        }
      />
      <div className="flex-1 flex flex-col items-center gap-10 p-6">
        <LanternBackground />

        {/* Participants — avatar row, each opens a profile */}
        <div className="flex flex-wrap justify-center gap-4">
          {gameConfig.characters.map((c) => (
            <Link
              key={c.id}
              href={`/story/participants/${c.id}`}
              className="flex flex-col items-center gap-1"
            >
              <Avatar name={c.id} />
              <span className="text-xs text-silver">{c.id}</span>
            </Link>
          ))}
        </div>

        <div className="flex-1 flex flex-col justify-center gap-5 w-64">
          <Link
            href={`/story/chat/${day}`}
            className="text-center py-4 rounded-2xl text-lg font-semibold bg-ink-black text-beige border-2 border-[#2f406d]"
          >
            {t("story.chat")}
          </Link>
          <Link
            href="/story/dms"
            className="text-center py-4 rounded-2xl text-lg font-semibold bg-ink-black text-beige border-2 border-[#2f406d]"
          >
            {t("story.dms")}
          </Link>
        </div>
      </div>
    </>
  );
}
