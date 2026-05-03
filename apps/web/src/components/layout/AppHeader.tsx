'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppHeader() {
  const pathname = usePathname();

  if (pathname === "/") return null;

  return (
    <header className="shrink-0 px-4 py-3 pt-[env(safe-area-inset-top)]">
      <Link href="/" className="mr-3">
        ←
      </Link>
      <span>百灯</span>
    </header>
  );
}
