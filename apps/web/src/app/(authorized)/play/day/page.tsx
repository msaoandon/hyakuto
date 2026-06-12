"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import manifestData from "@/data/manifest.json";
import type { Manifest } from "@/data/loadDay";
import { usePlay } from "../layout";

export default function DayPage() {
  const router = useRouter();
  const { selectedDay, setSelectedChat } = usePlay();

  const manifest = manifestData as Manifest;

  // guard: cold load / refresh has no selection
  useEffect(() => {
    if (selectedDay === null) router.replace("/play");
  }, [selectedDay, router]);
  if (selectedDay === null) return null;

  const day = manifest.days.find((d) => d.day === selectedDay);

  const threadIds = [
    ...new Set(
      (day?.segments ?? [])
        .map((id) => manifest.segments[id]?.thread_id)
        .filter((t): t is string => Boolean(t)),
    ),
  ];

  const open = (threadId: string) => {
    setSelectedChat(threadId);
    router.push("/play/chat");
  };

  return (
    <main className="flex flex-col items-center gap-4 p-6">
      <h1>Day {selectedDay}</h1>
      {threadIds.map((tid) => (
        <button
          key={tid}
          onClick={() => open(tid)}
          className="w-64 py-2 rounded-lg bg-[#cec0c4] text-ink-black"
        >
          {manifest.threads[tid]?.display_name ?? tid}
        </button>
      ))}
    </main>
  );
}
