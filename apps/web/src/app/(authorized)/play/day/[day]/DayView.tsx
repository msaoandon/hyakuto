"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listThreads, isThreadUnlocked } from "@/data/loadDay";
import { LanternBackground } from "@/components/LanternBackground";
import { useT } from "@/i18n";
import { useGameStore, saveToState } from "@/store/gameStore";

export function DayView({ day }: { day: string }) {
  const t = useT();
  const dayNum = Number(day);
  const save = useGameStore((s) => s.save);
  const completed = useGameStore((s) => s.completed);

  // Time-gated chats unlock as the wall-clock passes their time, with no state
  // change — so poll the clock (and re-check on focus) to reveal them on time.
  // NOTE: trusts the device clock for now; swap in trusted server time later
  // (see DEV_PLAN "Thread unlock & scheduling").
  const [now, setNow] = useState(() => Date.now());
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
    <main className="flex flex-col items-center gap-4 p-6">
      <LanternBackground />
      <h1>{t("play.day", { n: dayNum })}</h1>
      {listThreads(dayNum).map((thread) => {
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

        // VN units render in a different player than chats; route by kind.
        const href =
          thread.kind === "vn"
            ? `/play/day/${dayNum}/vn/${thread.id}`
            : `/play/day/${dayNum}/${thread.id}`;

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
    </main>
  );
}
