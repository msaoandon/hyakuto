"use client";

import Link from "next/link";
import { LanternBackground } from "@/components/LanternBackground";
import { useT } from "@/i18n";

// The persistent hub, reachable any time. Story is the primary action; the rest
// are secondary surfaces (some still stubs). History is a concept for now.
export default function LobbyPage() {
  const t = useT();

  const tiles: { href: string; label: string; glyph: string; disabled?: boolean }[] = [
    { href: "/library", label: t("lobby.library"), glyph: "📖" },
    { href: "/album", label: t("lobby.album"), glyph: "🖼" },
    { href: "/saved-games", label: t("lobby.load"), glyph: "💾" },
    { href: "#", label: t("lobby.history"), glyph: "🕘", disabled: true },
    { href: "/settings", label: t("lobby.settings"), glyph: "⚙️" },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-10 p-6">
      <LanternBackground />

      <Link
        href="/story"
        className="w-64 text-center py-4 rounded-2xl text-xl font-semibold bg-ink-black text-beige border-2 border-[#2f406d]"
      >
        {t("lobby.story")}
      </Link>

      <div className="grid grid-cols-3 gap-4">
        {tiles.map((tile) =>
          tile.disabled ? (
            <div
              key={tile.href}
              aria-disabled="true"
              className="w-20 h-20 flex flex-col items-center justify-center gap-1 rounded-xl bg-[#a5cbfd]/30 text-ink-black/40 cursor-not-allowed select-none"
            >
              <span className="text-2xl">{tile.glyph}</span>
              <span className="text-xs">{tile.label}</span>
            </div>
          ) : (
            <Link
              key={tile.href}
              href={tile.href}
              className="w-20 h-20 flex flex-col items-center justify-center gap-1 rounded-xl bg-[#a5cbfd] text-ink-black"
            >
              <span className="text-2xl">{tile.glyph}</span>
              <span className="text-xs">{tile.label}</span>
            </Link>
          ),
        )}
      </div>
    </div>
  );
}
