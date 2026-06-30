"use client";

import Link from "next/link";
import { useMemo } from "react";
import { listDays, dayStatus } from "@/data/loadDay";
import { useGameStore, saveToState } from "@/store/gameStore";
import { useT } from "@/i18n";

// Inline day selector above the chat list (replaces the old Timeline modal). One
// circle per authored day: completed days show a ✓ and link to that day, the
// day being viewed is highlighted, and not-yet-reached days show a lock and
// aren't navigable. Derived from the manifest's days + progress, never hardcoded.
export function DayRail({ viewedDay }: { viewedDay: number }) {
  const t = useT();
  const save = useGameStore((s) => s.save);
  const completed = useGameStore((s) => s.completed);
  const state = useMemo(() => saveToState(save, completed), [save, completed]);

  const base =
    "relative shrink-0 w-11 h-11 rounded-full flex items-center justify-center font-semibold text-sm";

  return (
    <nav
      aria-label={t("story.days")}
      className="flex gap-2 overflow-x-auto w-full max-w-md py-1 justify-center"
    >
      {listDays().map((d) => {
        const status = dayStatus(d.day, state); // past | current | future
        const selected = d.day === viewedDay;
        const label = t("play.day", { n: d.day });

        if (status === "future") {
          return (
            <div
              key={d.day}
              aria-label={`${label} 🔒`}
              aria-disabled="true"
              className={`${base} bg-[#a5cbfd]/20 text-ink-black/40 select-none`}
            >
              🔒
            </div>
          );
        }

        return (
          <Link
            key={d.day}
            href={`/story/chat/${d.day}`}
            aria-label={label}
            aria-current={selected ? "page" : undefined}
            className={`${base} bg-[#a5cbfd] text-ink-black ${
              selected ? "ring-2 ring-gold" : ""
            }`}
          >
            {d.day}
            {status === "past" && (
              <span
                aria-hidden="true"
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gold text-ink-black text-[10px] leading-none flex items-center justify-center"
              >
                ✓
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
