"use client";

import { useMemo, useState } from "react";
import {
  assembleDM,
  availableDmSegments,
  stripEffects,
  stripChoices,
  threadDisplayName,
} from "@/data/loadDay";
import { useGameStore, saveToState } from "@/store/gameStore";
import { ThreadPlayer } from "@/components/chat/ThreadPlayer";
import { StoryHeader } from "@/components/layout/StoryHeader";
import { useLocale, useT } from "@/i18n";

// A DM conversation. On (re)entry it plays only the *unread* segments — the new
// messages — so an already-read segment is never replayed (which would re-prompt
// its choice; we don't record chosen options until Phase 3). When the DM is fully
// caught up, it shows a non-interactive read-back of the whole conversation
// (choices + effects stripped). Reaching the end marks the unlocked segments read.
export function DmView({ thread }: { thread: string }) {
  const locale = useLocale();
  const t = useT();
  const save = useGameStore((s) => s.save);
  const completed = useGameStore((s) => s.completed);
  const markDmRead = useGameStore((s) => s.markDmRead);

  // Capture the read cursor once at open so it doesn't shift mid-conversation.
  const [readAtOpen] = useState(() => new Set(useGameStore.getState().dmRead[thread] ?? []));

  const available = useMemo(
    () => availableDmSegments(thread, saveToState(save, completed)),
    [thread, save, completed],
  );

  const segment = useMemo(() => {
    const state = saveToState(save, completed);
    const unread = available.filter((id) => !readAtOpen.has(id));
    if (unread.length > 0) return assembleDM(thread, state, unread, locale); // new messages, interactive
    // Caught up → read-back the full conversation without prompts or effects.
    return stripChoices(stripEffects(assembleDM(thread, state, available, locale)));
  }, [thread, save, completed, available, readAtOpen, locale]);

  const handleComplete = () => {
    markDmRead(thread, availableDmSegments(thread, saveToState(save, completed)));
  };

  // No conversation for this id — the build placeholder, or a DM with nothing
  // unlocked. Show an empty state instead of an empty player (which would
  // "complete" a non-existent thread). A reachable DM always has ≥1 segment.
  if (available.length === 0) {
    return (
      <>
        <StoryHeader back="/story/dms" title={t("story.dms")} />
        <div className="flex-1 flex items-center justify-center p-6 text-silver">
          {t("story.dmsEmpty")}
        </div>
      </>
    );
  }

  return (
    <ThreadPlayer
      segment={segment}
      title={threadDisplayName(thread, locale)}
      back="/story/dms"
      onComplete={handleComplete}
    />
  );
}
