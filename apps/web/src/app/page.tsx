'use client';

import Link from 'next/link';
import { Shippori_Mincho } from 'next/font/google';
import { LanguageChooser } from '@/components/LanguageChooser';
import { LanternBackground } from '@/components/LanternBackground';
import { useT } from '@/i18n';
import { useGameStore } from '@/store/gameStore';

const shipporiMincho = Shippori_Mincho({
  weight: '800',
  subsets: ['latin'],
});

// Splash + entry. The loading splash is held by HydrationGate; once the save is
// hydrated this renders. The first tap both enters the Lobby and satisfies the
// audio-unlock gesture (AudioProvider listens globally). The language chooser is
// a sibling of the tap target so tapping it doesn't navigate (moves to Settings
// later).
export default function Home() {
  const t = useT();
  const mcChosen = useGameStore((s) => s.mcChosen);

  return (
    <main className="relative min-h-screen">
      <Link
        href={mcChosen ? "/lobby" : "/welcome"}
        className="min-h-screen flex flex-col items-center justify-center gap-10 transition-colors duration-500"
      >
        <LanternBackground />
        <span className={`${shipporiMincho.className} text-[90px] text-black glow-title`}>百灯</span>
        <span className="text-ink-black/80 text-lg tracking-wide animate-pulse">{t('home.start')}</span>
      </Link>
      <div className="fixed top-[calc(env(safe-area-inset-top)+1rem)] right-[calc(env(safe-area-inset-right)+1rem)] z-20">
        <LanguageChooser />
      </div>
    </main>
  );
}
