"use client";

import { useState, useTransition } from "react";
import { deleteGame } from "@/app/actions";

// Delete a game from the list. Two-step (click → confirm) so a game and all its
// content isn't wiped by a single stray click.
export function DeleteGame({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function arm() { setConfirming(true); }
  function cancel() { setConfirming(false); }
  function confirm() { startTransition(async () => { await deleteGame(id); }); }

  if (!confirming)
    return (
      <button
        type="button"
        onClick={arm}
        className="text-xs text-muted hover:text-danger"
        aria-label={`Delete ${name}`}
      >
        delete
      </button>
    );

  return (
    <span className="flex items-center gap-2 text-xs">
      <button
        type="button"
        disabled={pending}
        onClick={confirm}
        className="text-danger hover:underline disabled:opacity-50"
      >
        {pending ? "deleting…" : "confirm"}
      </button>
      <button type="button" onClick={cancel} className="text-muted hover:text-silver">
        cancel
      </button>
    </span>
  );
}
