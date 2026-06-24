'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Shippori_Mincho } from 'next/font/google';
import { LanguageChooser } from '@/components/LanguageChooser';
import { LanternBackground } from '@/components/LanternBackground';
import { useT } from '@/i18n';

const shipporiMincho = Shippori_Mincho({
  weight: '800',
  subsets: ['latin'],
});

export default function Home() {
  const [progress, setProgress] = useState(1);
  const t = useT();

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-8 transition-colors duration-500"
    >
      <LanternBackground />
      <div className="fixed top-[calc(env(safe-area-inset-top)+1rem)] right-[calc(env(safe-area-inset-right)+1rem)]">
        <LanguageChooser />
      </div>
      <span className={`${shipporiMincho.className} text-[90px] text-black glow-title`}>百灯</span>
      <Link href="/play" className="w-64 text-center py-2 bg-[#a5cbfd] text-ink-black rounded-lg">{t('home.start')}</Link>
      {/* <p className="text-white text-lg">Candle progress: {Math.round(progress * 100)}%</p>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={progress}
        onChange={(e) => setProgress(Number(e.target.value))}
        className="w-64"
      /> */}
    </main>
  );

}