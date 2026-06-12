"use client";
import { createContext, useContext, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import manifestData from "@/data/manifest.json";
import type { Manifest } from "@/data/loadDay";

type PlayState = {
  selectedDay: number | null;
  selectedChat: string | null;
  setSelectedDay: (d: number | null) => void;
  setSelectedChat: (id: string | null) => void;
};

const PlayContext = createContext<PlayState | null>(null);

export function usePlay() {
  const ctx = useContext(PlayContext);
  if (!ctx) throw new Error("usePlay must be used inside /play");
  return ctx;
}

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const pathname = usePathname();
  const manifest = manifestData as Manifest;

  // back target + title per step (hierarchical, not always "/")
  const header =
    pathname === "/play"
      ? { back: "/", title: "Choose a day" }
      : pathname === "/play/day"
        ? { back: "/play", title: `Day ${selectedDay ?? ""}` }
        : pathname === "/play/chat"
          ? {
              back: "/play/day",
              title: manifest.threads[selectedChat ?? ""]?.display_name ?? "Chat",
            }
          : null;

  return (
    <PlayContext.Provider value={{ selectedDay, selectedChat, setSelectedDay, setSelectedChat }}>
      {header && (
        <header className="shrink-0 px-4 py-3 pt-[env(safe-area-inset-top)] bg-harcoal-blue flex items-center gap-3">
          <Link href={header.back}>←</Link>
          <span>{header.title}</span>
        </header>
      )}
      {children}
    </PlayContext.Provider>
  );
}
