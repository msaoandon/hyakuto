"use client";

import Link from "next/link";
import { useMemo } from "react";
import { listDMs } from "@/data/loadDay";
import { Avatar } from "@/components/chat/Avatar";
import { StoryHeader } from "@/components/layout/StoryHeader";
import { LanternBackground } from "@/components/LanternBackground";
import { useGameStore, saveToState } from "@/store/gameStore";
import { useT } from "@/i18n";

// The Messages inbox: ongoing 1:1 DMs that have started. A DM appears once its
// first segment unlocks (the contact "messages" you) — relationship-gated, never
// in the day chat list.
export default function DmInboxPage() {
  const t = useT();
  const save = useGameStore((s) => s.save);
  const completed = useGameStore((s) => s.completed);

  const dms = useMemo(
    () => listDMs(saveToState(save, completed)).filter((d) => d.available),
    [save, completed],
  );

  return (
    <>
      <StoryHeader back="/story" title={t("story.dms")} />
      <div className="flex-1 flex flex-col gap-2 p-4 overflow-y-auto">
        <LanternBackground />
        {dms.length === 0 ? (
          <p className="m-auto text-ink-black/50">{t("story.dmsEmpty")}</p>
        ) : (
          dms.map((dm) => {
            const done = `dm:${dm.id}` in completed;
            return (
              <Link
                key={dm.id}
                href={`/story/dms/${dm.id}`}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-[#a5cbfd] text-ink-black ${done ? "opacity-60" : ""}`}
              >
                <Avatar name={dm.contact ?? dm.display_name} />
                <span className="flex-1">{dm.display_name}</span>
                {done ? <span>✓</span> : null}
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}
