"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LanternBackground } from "@/components/LanternBackground";
import { useGameStore } from "@/store/gameStore";
import { exchangeCode, fetchServerSlot, type AuthAccount } from "@/data/authClient";
import { useT } from "@/i18n";

// Landing page for the OAuth dance (apps/api /v1/auth/complete redirects here
// with ?code=), reached from BOTH the /login front door and Settings' "Link
// account". Trades the one-time code for a bearer token — see
// authClient.exchangeCode and the adoption logic in apps/api/src/auth/routes.ts.
//
// Auto-restore: if the account already has a server save AND this device had
// nothing local yet (`wasFresh`, captured before the exchange fires — true for
// anyone arriving via /login, since that's the very first screen a fresh
// profile ever sees; false for anyone who already played as guest and is now
// linking from Settings), there is no conflict to resolve — pull the save
// down and hydrate the store directly.
//
// Conflict (MOBA-style, no silent merge): otherwise a genuine conflict exists
// — local progress on this device AND a different existing server save. The
// exchanged session is deliberately NOT adopted yet (store.signIn is never
// called here) — it's held in local `conflict` state until the player picks
// one side explicitly:
//   - "Use this account's save" — discards local progress, pulls the
//     account's save (store.restoreFromServer, same safe-replace path as
//     auto-restore).
//   - "Keep playing on this device" — discards the exchanged session instead
//     (store.abandonConflictedSignIn); local progress is untouched and was
//     never at risk since nothing was written to `session` for the
//     conflicting account.
// Neither local state nor the account's server save is ever partially
// touched or auto-merged — the player always makes the call.
//
// The code is single-use, so the exchange must fire exactly once even under
// React Strict Mode's double-effect in dev (the `fired` ref guards that, not a
// cleanup — a stray double GET here is a self-inflicted 400, not a real bug).
type Status = "exchanging" | "conflict" | "resolving" | "error";

export default function AuthReturnPage() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const signIn = useGameStore((s) => s.signIn);
  const restoreFromServer = useGameStore((s) => s.restoreFromServer);
  const abandonConflictedSignIn = useGameStore((s) => s.abandonConflictedSignIn);
  const [status, setStatus] = useState<Status>("exchanging");
  const [conflict, setConflict] = useState<{ token: string; account: AuthAccount } | null>(null);
  const [armedUseAccount, setArmedUseAccount] = useState(false);
  const [resolveFailed, setResolveFailed] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const code = params.get("code");
    if (!code) {
      setStatus("error");
      return;
    }

    const local = useGameStore.getState();
    const guestToken = local.session?.token ?? null;
    const wasFresh =
      !local.mcChosen && Object.keys(local.completed).length === 0 && Object.keys(local.dmRead).length === 0;

    exchangeCode(code, guestToken)
      .then(async (result) => {
        if (result.hasServerSave && wasFresh) {
          try {
            const payload = await fetchServerSlot(result.token);
            restoreFromServer({ token: result.token, account: result.account }, payload);
            router.replace(payload.mcChosen ? "/lobby" : "/welcome");
            return;
          } catch (err) {
            console.warn("auto-restore failed — falling back to the conflict choice:", err);
          }
        }
        if (result.hasServerSave) {
          setConflict({ token: result.token, account: result.account });
          setStatus("conflict");
          return;
        }
        signIn(result);
        router.replace(useGameStore.getState().mcChosen ? "/lobby" : "/welcome");
      })
      .catch(() => setStatus("error"));
    // Fires once on mount by design (see the fired-ref note above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToSettings = () => router.replace("/settings");

  const useAccountSave = async () => {
    if (!conflict) return;
    setStatus("resolving");
    setResolveFailed(false);
    try {
      const payload = await fetchServerSlot(conflict.token);
      restoreFromServer(conflict, payload);
      router.replace(payload.mcChosen ? "/lobby" : "/welcome");
    } catch (err) {
      console.warn("conflict resolution (use account's save) failed:", err);
      setStatus("conflict");
      setArmedUseAccount(false);
      setResolveFailed(true);
    }
  };

  const keepDeviceSave = async () => {
    if (!conflict) return;
    setStatus("resolving");
    await abandonConflictedSignIn(conflict.token);
    goToSettings();
  };

  const armUseAccount = () => setArmedUseAccount(true);
  const cancelUseAccount = () => setArmedUseAccount(false);

  return (
    <main className="relative flex-1 overflow-y-auto flex flex-col items-center justify-center p-6">
      <LanternBackground />
      <div className="relative w-full max-w-sm flex flex-col gap-4 rounded-2xl bg-ink-black/60 backdrop-blur-sm border border-[#2f406d] p-6 text-beige text-center">
        {(status === "exchanging" || status === "resolving") && <p>{t("account.connecting")}</p>}
        {status === "error" && (
          <>
            <p>{t("account.error")}</p>
            <button type="button" onClick={goToSettings} className="text-lantern-blue hover:underline">
              {t("settings.title")}
            </button>
          </>
        )}
        {status === "conflict" && (
          <>
            <p className="text-sm">{t("account.conflictNotice")}</p>
            {resolveFailed ? <p className="text-xs text-red-300">{t("account.conflictError")}</p> : null}

            {armedUseAccount ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-beige/70">{t("account.conflictUseAccountHint")}</p>
                <button
                  type="button"
                  onClick={useAccountSave}
                  className="w-full py-3 rounded-xl text-lg font-semibold bg-red-900/60 text-beige border-2 border-red-400/60"
                >
                  {t("account.conflictUseAccountConfirm")}
                </button>
                <button type="button" onClick={cancelUseAccount} className="text-beige/60 hover:text-beige text-sm">
                  {t("settings.cancel")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={armUseAccount}
                className="w-full py-3 rounded-xl text-lg font-semibold bg-navy-light/80 text-beige border-2 border-[#2f406d]"
              >
                {t("account.conflictUseAccount")}
              </button>
            )}

            <button type="button" onClick={keepDeviceSave} className="w-full py-3 rounded-xl text-lg font-semibold text-lantern-blue hover:underline">
              {t("account.conflictKeepDevice")}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
