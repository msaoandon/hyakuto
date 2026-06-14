"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { listThreads } from "@/data/loadDay";
import { useT } from "@/i18n";
import { usePlay } from "../layout";

export default function DayPage() {
  const router = useRouter();
  const t = useT();
  const { selectedDay, setSelectedChat } = usePlay();

  // guard: cold load / refresh has no selection
  useEffect(() => {
    if (selectedDay === null) router.replace("/play");
  }, [selectedDay, router]);
  if (selectedDay === null) return null;

  const open = (threadId: string) => {
    setSelectedChat(threadId);
    router.push("/play/chat");
  };

  return (
    <main className="flex flex-col items-center gap-4 p-6">
      <h1>{t("play.day", { n: selectedDay })}</h1>
      {listThreads(selectedDay).map((thread) => (
        <button
          key={thread.id}
          onClick={() => open(thread.id)}
          className="w-64 py-2 rounded-lg bg-[#cec0c4] text-ink-black"
        >
          {thread.display_name}
        </button>
      ))}
    </main>
  );
}
