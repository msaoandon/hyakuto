'use client';
import { useRouter } from 'next/navigation';
import { listDays } from '@/data/loadDay';
import { usePlay } from './layout';

export default function PlayPage() {
  const router = useRouter();
  const { setSelectedDay } = usePlay();

  const open = (day: number) => {
    setSelectedDay(day);
    router.push('/play/day');
  };

  return (
    <main className="flex flex-col items-center gap-4 p-6">
      <h1>Choose a day</h1>
      {listDays().map((d) => (
        <button key={d.day} onClick={() => open(d.day)} className="w-64 py-2 rounded-lg bg-[#cec0c4] text-ink-black">
          Day {d.day}
        </button>
      ))}
    </main>
  );
}
