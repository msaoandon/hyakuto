"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LanternBackground } from "@/components/LanternBackground";
import { LanguageChooser } from "@/components/LanguageChooser";
import { MusicToggle } from "@/components/MusicToggle";
import { McFields } from "@/components/mc/McFields";
import { useGameStore } from "@/store/gameStore";
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
      <div className="relative flex-1 flex flex-col gap-3 p-6 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <LanternBackground />
        <SettingRow label={t("settings.language")}>
          <LanguageChooser />
        </SettingRow>
        <SettingRow label={t("settings.music")}>
          <MusicToggle />
        </SettingRow>
        <div className="relative flex flex-col gap-4 rounded-xl bg-ink-black/40 px-4 py-3 text-beige">
          <span>{t("settings.mc")}</span>
          <McFields />
        </div>
        <NewGameRow />
      </div>
    </>
  );
}

// "Kill the current game": wipes the save, the MC identity, and the avatar
// (store.reset()), then routes back through the first-run picker. Two-step
// confirm — a whole playthrough must never die to one stray tap. This is also
// the local ancestor of the Phase-3 GDPR account-deletion flow.
function NewGameRow() {
  const t = useT();
  const router = useRouter();
  const reset = useGameStore((s) => s.reset);
  const [arming, setArming] = useState(false);

  const arm = () => setArming(true);
  const cancel = () => setArming(false);
  const erase = () => {
    reset();
    router.replace("/welcome"); // the authorized-layout guard would too; be explicit
  };

  return (
    <div className="relative flex items-center justify-between gap-4 rounded-xl bg-ink-black/40 border border-red-400/20 px-4 py-3 text-beige">
      <div className="flex flex-col">
        <span>{t("settings.newGame")}</span>
        <span className="text-xs text-beige/50">{t("settings.newGameHint")}</span>
      </div>
      {arming ? (
        <span className="flex items-center gap-3">
          <button type="button" onClick={erase} className="text-red-300 hover:underline">
            {t("settings.newGameConfirm")}
          </button>
          <button type="button" onClick={cancel} className="text-beige/60 hover:text-beige">
            {t("settings.cancel")}
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={arm}
          className="rounded bg-red-400/10 border border-red-400/30 text-red-300 px-3 py-1"
        >
          {t("settings.newGame")}
        </button>
      )}
    </div>
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
