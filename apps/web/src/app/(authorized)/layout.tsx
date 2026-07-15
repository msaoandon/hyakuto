"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { syncEnabled } from "@/data/authClient";

// Fresh-profile guard for every in-game route, two gates in order:
//  1. (only when sync is on) authChoiceMade — has the player signed in or
//     explicitly chosen "Continue as guest" on /login? A build with no API
//     has no account concept, so this gate never fires there.
//  2. mcChosen — has the player been through MC customisation? Routes to
//     /welcome. Deep link, PWA start URL, or post-reset all land here fresh.
// Existing installs are marked chosen/authChoiceMade by persist migrations, so
// these only ever catch genuinely fresh profiles. The store is already
// hydrated here (HydrationGate wraps the root layout), so both flags are
// trustworthy on first render.
export default function AuthorizedLayout({ children }: { children: ReactNode }) {
  const authChoiceMade = useGameStore((s) => s.authChoiceMade);
  const mcChosen = useGameStore((s) => s.mcChosen);
  const router = useRouter();
  const needsLogin = syncEnabled && !authChoiceMade;

  useEffect(() => {
    if (needsLogin) router.replace("/login");
    else if (!mcChosen) router.replace("/welcome");
  }, [needsLogin, mcChosen, router]);

  if (needsLogin || !mcChosen) return null; // redirecting — never flash the game underneath
  return <>{children}</>;
}
