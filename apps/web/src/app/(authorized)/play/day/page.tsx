'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import manifest from '@/data/manifest.json';
import { usePlay } from '../layout';

export default function DayPage() {
  const router = useRouter();
  const { selectedDay, setSelectedChat } = usePlay();

  // guard: cold load / refresh has no selection
  useEffect(() => {
    if (selectedDay === null) router.replace('/play');
  }, [selectedDay, router]);
  if (selectedDay === null) return null;

  const day = manifest.days.find((d) => d.day === selectedDay);
  const open = (segmentId: string) => {
    setSelectedChat(segmentId);
    router.push('/play/chat');
  };

  return (
    <main className="flex flex-col items-center gap-4 p-6">
      <h1>Day {selectedDay}</h1>
      {day?.segments.map((id) => (
        <button key={id} onClick={() => open(id)} className="w-64 py-2 rounded-lg bg-[#cec0c4] text-ink-black">
          {id}
        </button>
      ))}
    </main>
  );
}
