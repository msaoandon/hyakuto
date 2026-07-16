"use client";

import Link from "next/link";
import {
  IconBook2, IconPhoto, IconDeviceFloppy, IconHistory, IconSettings, type Icon,
} from "@tabler/icons-react";
import { LanternBackground } from "@/components/LanternBackground";
import { McAvatar } from "@/components/mc/McAvatar";
import { useGameStore } from "@/store/gameStore";
import { syncEnabled } from "@/data/authClient";
import { useT, useMcName } from "@/i18n";

// The persistent hub, reachable any time. Story is the primary action; the rest
// are secondary surfaces (some still stubs). History is a concept for now.

// Thin-stroke Tabler icons (default stroke is 2 — too heavy for the lobby).
const ICON_STROKE = 1.25;

const tileBase =
  "w-20 h-20 flex flex-col items-center justify-center gap-1 rounded-xl bg-navy-light/80";

export default function LobbyPage() {
  const t = useT();
  const mcName = useMcName();
  const session = useGameStore((s) => s.session);
  // No account = no recovery path if this device is lost or reinstalled — a
  // guest session token isn't something a player can ever re-enter by hand.
  // Never shown when sync is off: there's no account concept to link to.
  const showGuestBanner = syncEnabled && !session?.account;

  const tiles: { href: string; label: string; icon: Icon; disabled?: boolean }[] = [
    { href: "/library", label: t("lobby.library"), icon: IconBook2 },
    { href: "/album", label: t("lobby.album"), icon: IconPhoto },
    { href: "/saved-games", label: t("lobby.load"), icon: IconDeviceFloppy },
    { href: "#", label: t("lobby.history"), icon: IconHistory, disabled: true },
    { href: "/settings", label: t("lobby.settings"), icon: IconSettings },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-10 p-6">
      <LanternBackground />

      <Link href="/settings" className="flex flex-col items-center gap-2" aria-label={t("settings.mc")}>
        <McAvatar className="w-20 h-20 text-2xl" />
        <span className="text-ink-black/80 font-medium">{mcName}</span>
      </Link>

      <Link
        href="/story"
        className="w-64 text-center py-4 rounded-2xl text-xl font-semibold bg-navy-light/80 text-beige border-2 border-[#2f406d]"
      >
        {t("lobby.story")}
      </Link>

      <div className="grid grid-cols-3 gap-4">
        {tiles.map((tile) =>
          tile.disabled ? (
            <div
              key={tile.href}
              aria-disabled="true"
              className={`${tileBase} opacity-40 text-white/70 cursor-not-allowed select-none`}
            >
              <tile.icon size={28} stroke={ICON_STROKE} aria-hidden />
              <span className="text-xs">{tile.label}</span>
            </div>
          ) : (
            <Link key={tile.href} href={tile.href} className={`${tileBase} text-white`}>
              <tile.icon size={28} stroke={ICON_STROKE} aria-hidden />
              <span className="text-xs">{tile.label}</span>
            </Link>
          ),
        )}
      </div>

      {showGuestBanner ? (
        <Link
          href="/settings"
          className="fixed inset-x-6 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-20 rounded-xl bg-ink-black/70 px-4 py-2 text-center text-xs text-beige/80 backdrop-blur"
        >
          {t("lobby.guestBanner")}
        </Link>
      ) : null}
    </div>
  );
}
