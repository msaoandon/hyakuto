"use client";

import { useState, useEffect, type ReactNode } from "react";
import { Splash } from "./Splash";

export function HydrationGate({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  if (!hydrated) return <Splash />;
  return <>{children}</>;
}
