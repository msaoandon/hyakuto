'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [progress, setProgress] = useState(1);

  // Interpolate between amber (1.0) and near-black (0.0)
  const bg = `hsl(${30 * progress}, ${60 * progress}%, ${Math.max(5, 50 * progress)}%)`;

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-8 transition-colors duration-500"
      style={{
        backgroundColor: bg,
        // @ts-expect-error CSS custom property
        '--candle-progress': progress,
      }}
    >
      <Link href="/chat">Go to Chat</Link>
      <p className="text-white text-lg">Candle progress: {Math.round(progress * 100)}%</p>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={progress}
        onChange={(e) => setProgress(Number(e.target.value))}
        className="w-64"
      />
    </main>
  );

}