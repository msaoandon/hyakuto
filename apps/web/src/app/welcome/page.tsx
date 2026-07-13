"use client";

import { useRouter } from "next/navigation";
import { LanternBackground } from "@/components/LanternBackground";
import { McFields } from "@/components/mc/McFields";
import { useGameStore } from "@/store/gameStore";
import { useT } from "@/i18n";

// First-run MC customisation (docs/worldbuilding/mc.md): shown once between the
// splash tap and the Lobby when the profile is fresh (`mcChosen` false). All
// fields are optional — Begin with untouched defaults is a valid answer (name
// falls back to the localized "You"; address stays `unset`, the inclusive
// baseline). Editable any time afterwards in Settings.
export default function WelcomePage() {
  const router = useRouter();
  const t = useT();
  const setMc = useGameStore((s) => s.setMc);

  const begin = () => {
    setMc({}); // marks the picker answered, even untouched
    router.push("/lobby");
  };

  return (
    <main className="relative flex-1 overflow-y-auto flex flex-col items-center p-6">
      <LanternBackground />
      <div className="relative my-auto w-full max-w-sm flex flex-col gap-6 rounded-2xl bg-ink-black/60 backdrop-blur-sm border border-[#2f406d] p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-beige">{t("welcome.title")}</h1>
          <p className="text-sm text-beige/60">{t("welcome.hint")}</p>
        </div>
        <McFields />
        <button
          type="button"
          onClick={begin}
          className="w-full py-3 rounded-xl text-lg font-semibold bg-navy-light/80 text-beige border-2 border-[#2f406d]"
        >
          {t("welcome.begin")}
        </button>
      </div>
    </main>
  );
}
