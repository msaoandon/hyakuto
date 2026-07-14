"use client";

import { useGameStore } from "@/store/gameStore";
import { useT } from "@/i18n";
import { startSignIn, syncEnabled, PROVIDERS, type Provider } from "@/data/authClient";

// Settings → Account. Renders nothing when sync is disabled (no
// NEXT_PUBLIC_API_URL) — there is no account concept without a server. Signed
// out shows the two supported providers (Apple is deferred — needs the paid
// Apple Developer account); signed in shows the linked identity + sign out.
// Sign-in is a full-page navigation into the OAuth dance (authClient.startSignIn);
// the result lands back on /auth/return, which calls store.signIn().

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
      <span>{t("account.title")}</span>
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
              {t("account.signInWith", { provider: PROVIDER_LABEL[provider] })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
