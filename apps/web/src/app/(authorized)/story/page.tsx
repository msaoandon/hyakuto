"use client";

import Link from "next/link";
import { useMemo } from "react";
import { gameConfig } from "@hyakuto/game";
import { Avatar } from "@/components/chat/Avatar";
import { StoryHeader } from "@/components/layout/StoryHeader";
import { LanternBackground } from "@/components/LanternBackground";
import { currentDay, listDMs } from "@/data/loadDay";
import { useGameStore, saveToState } from "@/store/gameStore";
import { useT } from "@/i18n";

// The active-game hub: cast avatars up top, then the two doors (Chat / DMs).
// Participants are not a destination — just the avatar row. The current day is
// derived, so Chat always opens where the player actually is.
export default function StoryHubPage() {
  const t = useT();
  const save = useGameStore((s) => s.save);
  const completed = useGameStore((s) => s.completed);
  const dmRead = useGameStore((s) => s.dmRead);

  const day = useMemo(() => currentDay(saveToState(save, completed)), [save, completed]);
  const candles = save.counters.candles ?? 0;

  // Total unread across started DMs — surfaced on the DMs door.
  const dmUnread = useMemo(() => {
    return listDMs(saveToState(save, completed))
      .filter((d) => d.available)
      .reduce((n, d) => {
        const seen = new Set(dmRead[d.id] ?? []);
        return n + d.segments.filter((id) => !seen.has(id)).length;
      }, 0);
  }, [save, completed, dmRead]);

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
            className="relative text-center py-4 rounded-2xl text-lg font-semibold bg-ink-black text-beige border-2 border-[#2f406d]"
          >
            {t("story.dms")}
            {dmUnread > 0 && (
              <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 rounded-full bg-red-500 text-white text-sm font-bold flex items-center justify-center">
                {dmUnread}
              </span>
            )}
          </Link>
        </div>
      </div>
    </>
  );
}
