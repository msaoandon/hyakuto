"use client";

import { useMemo } from "react";
import { assembleDM, stripEffects, manifest } from "@/data/loadDay";
import { useGameStore, saveToState } from "@/store/gameStore";
import { ThreadPlayer } from "@/components/chat/ThreadPlayer";

// A DM conversation: assembled across all days (only the unlocked segments),
// then played by the shared ThreadPlayer. Back/exit go to the inbox.
export function DmView({ thread }: { thread: string }) {
  const save = useGameStore((s) => s.save);
  const completed = useGameStore((s) => s.completed);

  const segment = useMemo(() => {
    const seg = assembleDM(thread, saveToState(save, completed));
    return seg.id in completed ? stripEffects(seg) : seg;
  }, [thread, save, completed]);

  return (
    <ThreadPlayer
      segment={segment}
      title={manifest.threads[thread]?.display_name ?? thread}
      back="/story/dms"
    />
  );
}
