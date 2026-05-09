'use client';

import { useState } from 'react';

type DevConsoleProps = {
  axes: Record<string, number>;
  counters: Record<string, number>;
  flags: string[];
  lastEvent?: string;
};

export function DevConsole({ axes, counters, flags, lastEvent }: DevConsoleProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed top-16 right-2 z-50 bg-black/80 text-green-400 text-xs px-2 py-1 rounded font-mono"
      >
        ▶ DEV
      </button>
    );
  }

  return (
    <div className="fixed top-16 right-2 z-50 w-56 bg-black/90 text-green-400 text-xs font-mono rounded-lg p-3 shadow-lg">
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold">🛠 DEV</span>
        <button onClick={() => setCollapsed(true)} className="text-green-400/60 hover:text-green-400">✕</button>
      </div>

      {Object.keys(axes).length > 0 && (
        <div className="mb-2">
          <div className="text-green-400/60 mb-1">axes</div>
          {Object.entries(axes).map(([key, val]) => (
            <div key={key} className="flex justify-between">
              <span>{key}</span>
              <span className={val > 0 ? 'text-green-300' : val < 0 ? 'text-red-400' : ''}>{val}</span>
            </div>
          ))}
        </div>
      )}

      {Object.keys(counters).length > 0 && (
        <div className="mb-2">
          <div className="text-green-400/60 mb-1">counters</div>
          {Object.entries(counters).map(([key, val]) => (
            <div key={key} className="flex justify-between">
              <span>{key}</span>
              <span>{val}</span>
            </div>
          ))}
        </div>
      )}

      {flags.length > 0 && (
        <div className="mb-2">
          <div className="text-green-400/60 mb-1">flags</div>
          {flags.map(f => (
            <div key={f}>✓ {f}</div>
          ))}
        </div>
      )}

      {lastEvent && (
        <div className="mt-2 pt-2 border-t border-green-400/20 text-green-400/60 truncate">
          {lastEvent}
        </div>
      )}
    </div>
  );
}
