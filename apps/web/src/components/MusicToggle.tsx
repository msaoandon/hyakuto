"use client";

import { useGameStore } from "@/store/gameStore";
import { useT } from "@/i18n";

// Background-music on/off. The preference is persisted; AudioProvider fades the
// live playlist without tearing it down, so toggling is instant.
export function MusicToggle() {
  const enabled = useGameStore((s) => s.musicEnabled);
  const setMusicEnabled = useGameStore((s) => s.setMusicEnabled);
  const t = useT();

  return (
    <button
      role="switch"
      aria-checked={enabled}
      aria-label={t("settings.music")}
      onClick={() => setMusicEnabled(!enabled)}
      className="rounded bg-[#a5cbfd] text-ink-black px-3 py-1 font-medium min-w-16"
    >
      {enabled ? t("settings.on") : t("settings.off")}
    </button>
  );
}
