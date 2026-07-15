"use client";

import { useRouter } from "next/navigation";
import { LanternBackground } from "@/components/LanternBackground";
import { useGameStore } from "@/store/gameStore";
import { useT } from "@/i18n";
import { startSignIn, syncEnabled, PROVIDERS, type Provider } from "@/data/authClient";

// The auth front door (DEV_PLAN Phase 3): shown once, before /welcome, on any
// profile that hasn't made an auth choice yet — see the (authorized) layout
// guard. Signing in HERE is the safe auto-restore path: since nothing local
// exists yet, a returning account's server save can be pulled down with no
// conflict to resolve (see /auth/return's `wasFresh` check). "Continue as
// guest" just records the choice — no network call; sync still lazily mints a
// guest session on the first real sync event, same as it always has.
const PROVIDER_LABEL: Record<Provider, string> = { google: "Google", discord: "Discord" };
const RETURN_PATH = "/auth/return";

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const mcChosen = useGameStore((s) => s.mcChosen);
  const continueAsGuest = useGameStore((s) => s.continueAsGuest);

  if (!syncEnabled) return null; // unreachable via the guard; guards direct navigation too

  const signInWith = (provider: Provider) => () => startSignIn(provider, RETURN_PATH);
  const asGuest = () => {
    continueAsGuest();
    router.replace(mcChosen ? "/lobby" : "/welcome");
  };

  return (
    <main className="relative flex-1 overflow-y-auto flex flex-col items-center justify-center p-6">
      <LanternBackground />
      <div className="relative w-full max-w-sm flex flex-col gap-6 rounded-2xl bg-ink-black/60 backdrop-blur-sm border border-[#2f406d] p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-beige">{t("login.title")}</h1>
          <p className="text-sm text-beige/60">{t("login.subtitle")}</p>
        </div>
        <div className="flex flex-col gap-2">
          {PROVIDERS.map((provider) => (
            <button
              key={provider}
              type="button"
              onClick={signInWith(provider)}
              className="rounded-xl px-4 py-3 text-left bg-navy-light/80 text-white border border-[#2f406d] hover:bg-navy-light"
            >
              {t("account.signInWith", { provider: PROVIDER_LABEL[provider] })}
            </button>
          ))}
        </div>
        <button type="button" onClick={asGuest} className="text-sm text-beige/60 text-center hover:text-beige hover:underline">
          {t("login.continueAsGuest")}
        </button>
      </div>
    </main>
  );
}
