"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
      ) : null}
      {session?.account ? <DeleteAccountRow /> : null}
      {!session?.account ? (
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
      ) : null}
    </div>
  );
}

// Destructive, hard-to-reverse, and the server-side call is NOT best-effort
// (see gameStore.deleteAccount) — two-step confirm like Settings' New Game
// row, plus a visible error state on failure (silently "succeeding" locally
// while the server still holds the data would be worse than not offering it).
function DeleteAccountRow() {
  const t = useT();
  const router = useRouter();
  const deleteAccountAction = useGameStore((s) => s.deleteAccount);
  const [arming, setArming] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const arm = () => {
    setFailed(false);
    setArming(true);
  };
  const cancel = () => setArming(false);
  const erase = async () => {
    setPending(true);
    setFailed(false);
    try {
      await deleteAccountAction();
      router.replace("/login"); // the authorized-layout guard would too; be explicit
    } catch (err) {
      console.warn("account deletion failed — nothing was erased:", err);
      setFailed(true);
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t border-beige/10 pt-3">
      {failed ? <span className="text-xs text-red-300">{t("account.deleteError")}</span> : null}
      {arming ? (
        <span className="flex items-center gap-3">
          <span className="text-xs text-beige/50">{t("account.deleteHint")}</span>
          <button
            type="button"
            onClick={erase}
            disabled={pending}
            className="text-red-300 hover:underline disabled:opacity-50"
          >
            {pending ? t("account.connecting") : t("account.deleteConfirm")}
          </button>
          <button type="button" onClick={cancel} className="text-beige/60 hover:text-beige">
            {t("settings.cancel")}
          </button>
        </span>
      ) : (
        <button type="button" onClick={arm} className="self-start text-sm text-red-300/80 hover:text-red-300 hover:underline">
          {t("account.delete")}
        </button>
      )}
    </div>
  );
}
