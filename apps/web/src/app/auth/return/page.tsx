"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LanternBackground } from "@/components/LanternBackground";
import { useGameStore } from "@/store/gameStore";
import { exchangeCode, fetchServerSlot } from "@/data/authClient";
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
// down and hydrate the store directly. Otherwise a genuine conflict exists:
// show the notice and touch nothing (the merge/choose UX is deliberately
// deferred — see DEV_PLAN).
//
// The code is single-use, so the exchange must fire exactly once even under
// React Strict Mode's double-effect in dev (the `fired` ref guards that, not a
// cleanup — a stray double GET here is a self-inflicted 400, not a real bug).
type Status = "exchanging" | "restoreNotice" | "error";

export default function AuthReturnPage() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const signIn = useGameStore((s) => s.signIn);
  const restoreFromServer = useGameStore((s) => s.restoreFromServer);
  const [status, setStatus] = useState<Status>("exchanging");
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
            console.warn("auto-restore failed — falling back to the conflict notice:", err);
          }
        }
        signIn(result);
        if (result.hasServerSave) {
          setStatus("restoreNotice");
          return;
        }
        router.replace(useGameStore.getState().mcChosen ? "/lobby" : "/welcome");
      })
      .catch(() => setStatus("error"));
    // Fires once on mount by design (see the fired-ref note above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToSettings = () => router.replace("/settings");

  return (
    <main className="relative flex-1 overflow-y-auto flex flex-col items-center justify-center p-6">
      <LanternBackground />
      <div className="relative w-full max-w-sm flex flex-col gap-4 rounded-2xl bg-ink-black/60 backdrop-blur-sm border border-[#2f406d] p-6 text-beige text-center">
        {status === "exchanging" && <p>{t("account.connecting")}</p>}
        {status === "error" && (
          <>
            <p>{t("account.error")}</p>
            <button type="button" onClick={goToSettings} className="text-lantern-blue hover:underline">
              {t("settings.title")}
            </button>
          </>
        )}
        {status === "restoreNotice" && (
          <>
            <p className="text-sm">{t("account.restoreNotice")}</p>
            <button
              type="button"
              onClick={goToSettings}
              className="w-full py-3 rounded-xl text-lg font-semibold bg-navy-light/80 text-beige border-2 border-[#2f406d]"
            >
              {t("settings.title")}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
