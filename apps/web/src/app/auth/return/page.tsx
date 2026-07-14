"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LanternBackground } from "@/components/LanternBackground";
import { useGameStore } from "@/store/gameStore";
import { exchangeCode } from "@/data/authClient";
import { useT } from "@/i18n";

// Landing page for the OAuth dance (apps/api /v1/auth/complete redirects here
// with ?code=). Trades the one-time code for a bearer token — see
// authClient.exchangeCode and the adoption logic in apps/api/src/auth/routes.ts.
// The code is single-use, so the exchange must fire exactly once even under
// React Strict Mode's double-effect in dev (the `fired` ref guards that, not a
// cleanup — a stray double GET here is a self-inflicted 400, not a real bug).
type Status = "exchanging" | "restoreNotice" | "error";

export default function AuthReturnPage() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const guestToken = useGameStore((s) => s.session?.token ?? null);
  const signIn = useGameStore((s) => s.signIn);
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
    exchangeCode(code, guestToken)
      .then((result) => {
        signIn({ token: result.token, account: result.account });
        if (result.hasServerSave) setStatus("restoreNotice");
        else router.replace("/settings");
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
