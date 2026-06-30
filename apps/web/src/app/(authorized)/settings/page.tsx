"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LanternBackground } from "@/components/LanternBackground";
import { LanguageChooser } from "@/components/LanguageChooser";
import { MusicToggle } from "@/components/MusicToggle";
import { useT } from "@/i18n";

// Player preferences. Two basic controls for now (language, music); the page is
// the seam more settings (MC customisation, account, notifications) plug into.
export default function SettingsPage() {
  const t = useT();
  return (
    <>
      <header className="shrink-0 text-lantern-blue px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] flex items-center gap-3 bg-black/30">
        <Link href="/lobby" aria-label="back" className="text-xl leading-none">
          ←
        </Link>
        <span className="flex-1 truncate">{t("settings.title")}</span>
      </header>
      <div className="relative flex-1 flex flex-col gap-3 p-6">
        <LanternBackground />
        <SettingRow label={t("settings.language")}>
          <LanguageChooser />
        </SettingRow>
        <SettingRow label={t("settings.music")}>
          <MusicToggle />
        </SettingRow>
      </div>
    </>
  );
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="relative flex items-center justify-between gap-4 rounded-xl bg-ink-black/40 px-4 py-3 text-beige">
      <span>{label}</span>
      {children}
    </div>
  );
}
