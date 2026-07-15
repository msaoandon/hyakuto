"use client";

import { useGameStore } from "@/store/gameStore";
import { useT } from "@/i18n";
import { startSignIn, syncEnabled, PROVIDERS, type Provider } from "@/data/authClient";

// Settings → Account. Renders nothing when sync is disabled (no
// NEXT_PUBLIC_API_URL) — there is no account concept without a server. Signed
// out this is framed as LINKING (not signing in): by the time someone reaches
// Settings they've already been playing (as a guest, past the /login front
// door), so the action is "attach an account to my existing progress," not
// "log in to start" — that framing lives on /login instead, where a fresh
// device really is choosing how to begin. Sign-in is a full-page navigation
// into the OAuth dance (authClient.startSignIn); the result lands on
// /auth/return, which calls store.signIn() (or restoreFromServer() on the
// safe-auto-restore path — moot here, since anyone reaching this component
// already has local progress by definition).

const PROVIDER_LABEL: Record<Provider, string> = { google: "Google", discord: "Discord" };

const RETURN_PATH = "/auth/return";

export function AccountSection() {
  const t = useT();
  const session = useGameStore((s) => s.session);
  const signOut = useGameStore((s) => s.signOut);

  if (!syncEnabled) return null;

  const doSignOut = () => void signOut();
  const signInWith = (provider: Provider) => () => startSignIn(provider, RETURN_PATH);

  return (
    <div className="relative flex flex-col gap-3 rounded-xl bg-ink-black/40 px-4 py-3 text-beige">
      <span>{t(session?.account ? "account.title" : "account.linkTitle")}</span>
      {session?.account ? (
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-beige/70">
            {t("account.signedInAs", { provider: PROVIDER_LABEL[session.account.provider as Provider] ?? session.account.provider })}
          </span>
          <button type="button" onClick={doSignOut} className="text-sm text-beige/60 hover:text-beige hover:underline">
            {t("account.signOut")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-xs text-beige/50">{t("account.guestNote")}</span>
          {PROVIDERS.map((provider) => (
            <button
              key={provider}
              type="button"
              onClick={signInWith(provider)}
              className="rounded-xl px-4 py-3 text-left bg-navy-light/80 text-white border border-[#2f406d] hover:bg-navy-light"
            >
              {t("account.linkWith", { provider: PROVIDER_LABEL[provider] })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
