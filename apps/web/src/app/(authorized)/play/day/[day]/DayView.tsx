"use client";
import Link from "next/link";
import { listThreads } from "@/data/loadDay";
import { LanternBackground } from "@/components/LanternBackground";
import { useT } from "@/i18n";
import { useGameStore } from "@/store/gameStore";

export function DayView({ day }: { day: string }) {
  const t = useT();
  const dayNum = Number(day);
  const completed = useGameStore((s) => s.completed);

  return (
    <main className="flex flex-col items-center gap-4 p-6">
      <LanternBackground />
      <h1>{t("play.day", { n: dayNum })}</h1>
      {listThreads(dayNum).map((thread) => {
        const done = completed.includes(`${dayNum}:${thread.id}`);
        return (
          <Link key={thread.id} href={`/play/day/${dayNum}/${thread.id}`}
            className={`w-64 text-center py-2 rounded-lg bg-[#a5cbfd] text-ink-black ${done ? "opacity-60" : ""}`}>
            {thread.display_name}{done ? " ✓" : ""}
          </Link>
        );
      })}
    </main>
  );
}
