"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listThreads, isThreadUnlocked } from "@/data/loadDay";
import { StoryHeader } from "@/components/layout/StoryHeader";
import { LanternBackground } from "@/components/LanternBackground";
import { Timeline } from "./Timeline";
import { useT, useLocale } from "@/i18n";
import { useGameStore, saveToState } from "@/store/gameStore";

// The current day's chat list (chats + VN units). Past/future days are reached
// only through the Timeline modal — this screen always shows one day.
export function ChatDayView({ day }: { day: string }) {
  const t = useT();
  const locale = useLocale();
  const dayNum = Number(day);
  const save = useGameStore((s) => s.save);
  const completed = useGameStore((s) => s.completed);

  // Time-gated chats reveal as the wall-clock passes; poll + re-check on focus.
  const [now, setNow] = useState(() => Date.now());
  const [timelineOpen, setTimelineOpen] = useState(false);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 30_000);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, []);

  const state = useMemo(() => saveToState(save, completed), [save, completed]);

  return (
    <>
      <StoryHeader
        back="/story"
        title={t("play.day", { n: dayNum })}
        right={
          <button
            onClick={() => setTimelineOpen(true)}
            aria-label={t("story.timeline")}
            className="text-xl leading-none"
          >
            ▦
          </button>
        }
      />
      <div className="flex-1 flex flex-col items-center gap-4 p-6 overflow-y-auto">
        <LanternBackground />
        {listThreads(dayNum, locale)
          .filter((thread) => thread.kind !== "dm") // DMs live in the Messages inbox
          .map((thread) => {
            const done = `${dayNum}:${thread.id}` in completed;
            const unlocked = isThreadUnlocked(dayNum, thread.id, state, now);

            if (!unlocked) {
              return (
                <div
                  key={thread.id}
                  aria-disabled="true"
                  className="w-64 text-center py-2 rounded-lg bg-[#a5cbfd]/30 text-ink-black/50 cursor-not-allowed select-none"
                >
                  🔒 {thread.display_name}
                </div>
              );
            }

            const href =
              thread.kind === "vn"
                ? `/story/chat/${dayNum}/vn/${thread.id}`
                : `/story/chat/${dayNum}/${thread.id}`;

            return (
              <Link
                key={thread.id}
                href={href}
                className={`w-64 text-center py-2 rounded-lg bg-[#a5cbfd] text-ink-black ${done ? "opacity-60" : ""}`}
              >
                {thread.kind === "vn" ? "📖 " : ""}
                {thread.display_name}
                {done ? " ✓" : ""}
              </Link>
            );
          })}
      </div>
      {timelineOpen && <Timeline onClose={() => setTimelineOpen(false)} />}
    </>
  );
}
