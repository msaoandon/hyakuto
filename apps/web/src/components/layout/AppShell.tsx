'use client';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-dvh">
      {children}
    </div>
  );
}
