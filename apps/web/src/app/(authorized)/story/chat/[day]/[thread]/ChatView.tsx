"use client";

import { useMemo } from "react";
import { assembleThread, stripEffects, resolveChoices, threadDisplayName, manifest } from "@/data/loadDay";
import { useGameStore, saveToState } from "@/store/gameStore";
import { ThreadPlayer } from "@/components/chat/ThreadPlayer";
import { useT, useLocale } from "@/i18n";

export function ChatView({ day, thread }: { day: string; thread: string }) {
  const t = useT();
  const locale = useLocale();
  const dayNum = Number(day);
  const save = useGameStore((s) => s.save);
  const completed = useGameStore((s) => s.completed);

  // Assemble the day's thread. A completed thread replays as a transcript:
  // recorded picks render as MC replies (no re-prompt), effects never re-apply;
  // an unrecorded (legacy) pick still re-prompts, as before.
  const segment = useMemo(() => {
    const state = saveToState(save, completed);
    const seg = assembleThread(dayNum, thread, state, locale);
    return seg.id in completed ? stripEffects(resolveChoices(seg, state.choices)) : seg;
  }, [dayNum, thread, save, completed, locale]);

  return (
    <ThreadPlayer
      segment={segment}
      title={manifest.threads[thread] ? threadDisplayName(thread, locale) : t("play.chat")}
      back={`/story/chat/${dayNum}`}
    />
  );
}
