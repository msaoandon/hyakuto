"use client";

import Link from "next/link";
import { useMemo } from "react";
import { listDays, dayStatus } from "@/data/loadDay";
import { useGameStore, saveToState } from "@/store/gameStore";
import { useT } from "@/i18n";

// The cross-day navigator: every day classified past (✓, rereadable), current
// (▸), or future (🔒, not navigable). The only way to reach another day.
export function Timeline({ onClose }: { onClose: () => void }) {
  const t = useT();
  const save = useGameStore((s) => s.save);
  const completed = useGameStore((s) => s.completed);
  const state = useMemo(() => saveToState(save, completed), [save, completed]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-dark-gray border border-[#2f406d] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-beige font-semibold">{t("story.timeline")}</span>
          <button onClick={onClose} aria-label="close" className="text-beige/70 text-lg">
            ✕
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {listDays().map((d) => {
            const status = dayStatus(d.day, state);
            const label = t("play.day", { n: d.day });

            if (status === "future") {
              return (
                <li
                  key={d.day}
                  aria-disabled="true"
                  className="px-4 py-2 rounded-lg bg-[#a5cbfd]/20 text-ink-black/40 select-none"
                >
                  🔒 {label}
                </li>
              );
            }

            return (
              <li key={d.day}>
                <Link
                  href={`/story/chat/${d.day}`}
                  onClick={onClose}
                  className={`block px-4 py-2 rounded-lg bg-[#a5cbfd] text-ink-black ${
                    status === "current" ? "ring-2 ring-gold" : ""
                  }`}
                >
                  {status === "current" ? "▸ " : "✓ "}
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
