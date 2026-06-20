'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import manifestData from '@/data/manifest.json';
import type { Manifest } from '@/data/loadDay';
import { useT } from '@/i18n';

const manifest = manifestData as Manifest;

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const { day, thread } = useParams<{ day?: string; thread?: string }>();

  const header = thread
    ? { back: `/play/day/${day}`, title: manifest.threads[thread]?.display_name ?? t('play.chat') }
    : day
      ? { back: '/play', title: t('play.day', { n: Number(day) }) }
      : { back: '/', title: t('play.chooseDay') };

  return (
    <>
      <header className="shrink-0 px-4 py-3 pt-[env(safe-area-inset-top)] bg-harcoal-blue flex items-center gap-3">
        <Link href={header.back}>←</Link>
        <span>{header.title}</span>
      </header>
      {children}
    </>
  );
}
