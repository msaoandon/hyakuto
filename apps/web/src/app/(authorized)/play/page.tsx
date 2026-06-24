'use client';
import Link from 'next/link';
import { listDays } from '@/data/loadDay';
import { LanternBackground } from '@/components/LanternBackground';
import { useT } from '@/i18n';

export default function PlayPage() {
  const t = useT();
  return (
    <main className="flex flex-col items-center gap-4 p-6">
      <LanternBackground />
      <h1>{t('play.chooseDay')}</h1>
      {listDays().map((d) => (
        <Link
          key={d.day}
          href={`/play/day/${d.day}`}
          className="w-64 text-center py-2 rounded-lg bg-[#a5cbfd] text-ink-black"
        >
          {t('play.day', { n: d.day })}
        </Link>
      ))}
    </main>
  );
}
