'use client';
import { createContext, useContext, useState } from 'react';

type PlayState = {
  selectedDay: number | null;
  selectedChat: string | null;
  setSelectedDay: (d: number | null) => void;
  setSelectedChat: (id: string | null) => void;
};

const PlayContext = createContext<PlayState | null>(null);

export function usePlay() {
  const ctx = useContext(PlayContext);
  if (!ctx) throw new Error('usePlay must be used inside /play');
  return ctx;
}

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  return (
    <PlayContext.Provider value={{ selectedDay, selectedChat, setSelectedDay, setSelectedChat }}>
      {children}
    </PlayContext.Provider>
  );
}
