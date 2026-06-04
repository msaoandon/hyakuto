'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Shippori_Mincho } from 'next/font/google';

const shipporiMincho = Shippori_Mincho({
  weight: '800',
  subsets: ['latin'],
});

export default function Home() {
  const [progress, setProgress] = useState(1);

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-8 transition-colors duration-500"
    >
      <span className={`${shipporiMincho.className} text-[72px]`}>百灯</span>
      <Link href="/chat" className="w-64 text-center py-2 bg-[#cec0c4] text-ink-black rounded-lg">Start</Link>
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