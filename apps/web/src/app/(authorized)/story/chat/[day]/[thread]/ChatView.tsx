"use client";

import { useMemo } from "react";
import { assembleThread, stripEffects, threadDisplayName, manifest } from "@/data/loadDay";
import { useGameStore, saveToState } from "@/store/gameStore";
import { ThreadPlayer } from "@/components/chat/ThreadPlayer";
import { useT, useLocale } from "@/i18n";

export function ChatView({ day, thread }: { day: string; thread: string }) {
  const t = useT();
  const locale = useLocale();
  const dayNum = Number(day);
  const save = useGameStore((s) => s.save);
  const completed = useGameStore((s) => s.completed);

  // Assemble the day's thread; a completed thread re-renders with effects stripped.
  const segment = useMemo(() => {
    const seg = assembleThread(dayNum, thread, saveToState(save, completed), locale);
    return seg.id in completed ? stripEffects(seg) : seg;
  }, [dayNum, thread, save, completed, locale]);

  return (
    <ThreadPlayer
      segment={segment}
      title={manifest.threads[thread] ? threadDisplayName(thread, locale) : t("play.chat")}
      back={`/story/chat/${dayNum}`}
    />
  );
}
