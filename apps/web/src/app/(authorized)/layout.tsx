"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";

// Fresh-profile guard for every in-game route: a profile that has never been
// through the /welcome picker (deep link, PWA start URL, post-reset) is routed
// there first — the splash-tap branch alone can be skipped. Existing installs
// are marked chosen by the persist v3 migration, so this only ever catches
// genuinely fresh profiles. The store is already hydrated here (HydrationGate
// wraps the root layout), so mcChosen is trustworthy on first render.
export default function AuthorizedLayout({ children }: { children: ReactNode }) {
  const mcChosen = useGameStore((s) => s.mcChosen);
  const router = useRouter();

  useEffect(() => {
    if (!mcChosen) router.replace("/welcome");
  }, [mcChosen, router]);

  if (!mcChosen) return null; // redirecting — never flash the game underneath
  return <>{children}</>;
}
