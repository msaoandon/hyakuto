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
  const dmRead = useGameStore((s) => s.dmRead);

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
            // Unread = unlocked segments the player hasn't read yet ("new messages").
            const seen = new Set(dmRead[dm.id] ?? []);
            const unread = dm.segments.filter((id) => !seen.has(id)).length;
            return (
              <Link
                key={dm.id}
                href={`/story/dms/${dm.id}`}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-[#a5cbfd] text-ink-black ${unread === 0 ? "opacity-60" : ""}`}
              >
                <Avatar name={dm.contact ?? dm.display_name} />
                <span className="flex-1 font-medium">{dm.display_name}</span>
                {unread > 0 ? (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-ink-black text-beige text-xs font-bold flex items-center justify-center">
                    {unread}
                  </span>
                ) : (
                  <span>✓</span>
                )}
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}
