"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listThreads, isThreadUnlocked, nextUnlockAt } from "@/data/loadDay";
import { StoryHeader } from "@/components/layout/StoryHeader";
import { LanternBackground } from "@/components/LanternBackground";
import { DayRail } from "./DayRail";
import { useT, useLocale } from "@/i18n";
import { useGameStore, saveToState } from "@/store/gameStore";

// A day's chat list (chats + VN units), with a day rail on top to switch days:
// completed days are rereadable, the viewed day is highlighted, future days lock.
export function ChatDayView({ day }: { day: string }) {
  const t = useT();
  const locale = useLocale();
  const dayNum = Number(day);
  const save = useGameStore((s) => s.save);
  const completed = useGameStore((s) => s.completed);

  const state = useMemo(() => saveToState(save, completed), [save, completed]);

  // Time-gated chats reveal the moment the wall-clock crosses their unlock.
  // Instead of polling, arm ONE timer for the earliest pending unlock
  // (nextUnlockAt gives the exact timestamp) and re-arm after it fires; when
  // nothing is pending there is no timer at all. visibilitychange + focus
  // re-checks cover sleep/wake, the Capacitor webview resuming, and device
  // clock changes — cases a poll can miss or hit late.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());

    const t = Date.now();
    const pending = listThreads(dayNum, locale)
      .filter((thread) => thread.kind !== "dm")
      .map((thread) => nextUnlockAt(dayNum, thread.id, state, t))
      .filter((at): at is number => at !== null && at > t);

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (pending.length > 0) {
      // A small cushion past the boundary; clamp to setTimeout's int32 ceiling
      // (~24.8 days) — the re-arm on fire covers anything farther out.
      const wait = Math.min(...pending) - t + 250;
      timer = setTimeout(tick, Math.min(wait, 2 ** 31 - 1));
    }

    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
    // Re-runs on every tick (`now`) so the timer re-arms for the next unlock,
    // and on state changes (completing a prerequisite starts the next gate).
  }, [dayNum, locale, state, now]);

  return (
    <>
      <StoryHeader back="/story" title={t("play.day", { n: dayNum })} />
      <div className="flex-1 flex flex-col items-center gap-4 p-6 overflow-y-auto">
        <LanternBackground />
        <DayRail viewedDay={dayNum} />
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
                data-testid="thread-link"
                data-kind={thread.kind}
                data-done={done ? "1" : "0"}
                className={`w-64 text-center py-2 rounded-lg bg-[#a5cbfd] text-ink-black ${done ? "opacity-60" : ""}`}
              >
                {thread.kind === "vn" ? "📖 " : ""}
                {thread.display_name}
                {done ? " ✓" : ""}
              </Link>
            );
          })}
      </div>
    </>
  );
}
