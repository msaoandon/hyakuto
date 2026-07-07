"use client";

import { useState, useEffect, type ReactNode } from "react";
import { SplashScreen } from "@capacitor/splash-screen";
import { Splash } from "./Splash";
import { useGameStore } from "@/store/gameStore";

export function HydrationGate({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsub = useGameStore.persist.onFinishHydration(() => {
      // The persisted state is known now: a fresh profile adopts the device
      // language (an explicit pick — localeChosen — always wins).
      useGameStore.getState().seedLocaleFromDevice();
      setHydrated(true);
      // Release the native splash (held via launchAutoHide: false) only once
      // the web gate clears — a seamless handoff, no flash of unhydrated UI.
      // No-op on the plain web build.
      void SplashScreen.hide();
    });
    useGameStore.persist.rehydrate(); // start the IndexedDB read (browser only)
    return unsub;
  }, []);

  if (!hydrated) return <Splash />;
  return <>{children}</>;
}
