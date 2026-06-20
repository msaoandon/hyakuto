"use client";

import { useState, useEffect, type ReactNode } from "react";
import { Splash } from "./Splash";
import { useGameStore } from "@/store/gameStore";

export function HydrationGate({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

useEffect(() => {
  const unsub = useGameStore.persist.onFinishHydration(() => setHydrated(true));
  useGameStore.persist.rehydrate();   // start the IndexedDB read (browser only)
  return unsub;
}, []);


  if (!hydrated) return <Splash />;
  return <>{children}</>;
}
