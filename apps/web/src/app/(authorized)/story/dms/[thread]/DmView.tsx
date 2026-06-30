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
import { useLocale } from "@/i18n";

// A DM conversation. On (re)entry it plays only the *unread* segments — the new
// messages — so an already-read segment is never replayed (which would re-prompt
// its choice; we don't record chosen options until Phase 3). When the DM is fully
// caught up, it shows a non-interactive read-back of the whole conversation
// (choices + effects stripped). Reaching the end marks the unlocked segments read.
export function DmView({ thread }: { thread: string }) {
  const locale = useLocale();
  const save = useGameStore((s) => s.save);
  const completed = useGameStore((s) => s.completed);
  const markDmRead = useGameStore((s) => s.markDmRead);

  // Capture the read cursor once at open so it doesn't shift mid-conversation.
  const [readAtOpen] = useState(() => new Set(useGameStore.getState().dmRead[thread] ?? []));

  const segment = useMemo(() => {
    const state = saveToState(save, completed);
    const available = availableDmSegments(thread, state);
    const unread = available.filter((id) => !readAtOpen.has(id));
    if (unread.length > 0) return assembleDM(thread, state, unread, locale); // new messages, interactive
    // Caught up → read-back the full conversation without prompts or effects.
    return stripChoices(stripEffects(assembleDM(thread, state, available, locale)));
  }, [thread, save, completed, readAtOpen, locale]);

  const handleComplete = () => {
    markDmRead(thread, availableDmSegments(thread, saveToState(save, completed)));
  };

  return (
    <ThreadPlayer
      segment={segment}
      title={threadDisplayName(thread, locale)}
      back="/story/dms"
      onComplete={handleComplete}
    />
  );
}
