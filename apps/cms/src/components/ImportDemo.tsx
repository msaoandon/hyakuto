"use client";

import { useState, useTransition } from "react";
import { importDemo } from "@/app/actions";

// Import the demo into an existing game. When the game already has content this
// replaces it, so we require a confirm; an empty game imports in one click.
export function ImportDemo({ gameId, hasContent }: { gameId: string; hasContent: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const arm = () => setConfirming(true);
  const disarm = () => setConfirming(false);

  const run = () =>
    startTransition(async () => {
      setError(null);
      const result = await importDemo(gameId);
      if (!result.ok) setError(result.error);
      else setConfirming(false);
    });

  const primary =
    "rounded border border-gold/60 bg-gold/10 px-4 py-2 text-sm text-gold hover:bg-gold/20 disabled:opacity-50";

  if (hasContent && confirming) {
    return (
      <span className="flex items-center gap-3 text-sm">
        <span className="text-muted">Replace all content with the demo?</span>
        <button type="button" disabled={pending} onClick={run} className="text-danger hover:underline disabled:opacity-50">
          {pending ? "importing…" : "replace"}
        </button>
        <button type="button" onClick={disarm} className="text-muted hover:text-silver">
          cancel
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={hasContent ? arm : run}
        className={hasContent ? "text-xs text-muted hover:text-silver" : primary}
      >
        {pending ? "Importing…" : hasContent ? "Import demo (replaces content)" : "Import current demo"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
