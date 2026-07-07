"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGame } from "@/app/actions";

// Create a game: name it, then import today's demo (exercises importProject) or
// start empty. On success, jump straight into the new game's world config.
export function NewGame() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const create = (mode: "demo" | "empty") =>
    startTransition(async () => {
      setError(null);
      const result = await createGame(name, mode);
      if (result.ok) router.push(`/g/${result.id}/world`);
      else setError(result.error);
    });
  const editName = (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value);
  const createDemo = () => create("demo");
  const createEmpty = () => create("empty");

  return (
    <section className="max-w-md space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-medium text-silver">New game</h2>
        <p className="text-sm text-muted">
          A game is a workspace with its own world config, OST, and content.
        </p>
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-muted">Name</span>
        <input
          autoFocus
          value={name}
          onChange={editName}
          placeholder="e.g. Hyakutō"
          className="w-full rounded border border-edge bg-ink px-3 py-2 text-sm text-silver outline-none focus:border-gold/60"
        />
      </label>

      <div className="flex gap-3">
        <button
          type="button"
          disabled={pending || !name.trim()}
          onClick={createDemo}
          className="rounded border border-gold/60 bg-gold/10 px-4 py-2 text-sm text-gold hover:bg-gold/20 disabled:opacity-50"
        >
          Import current demo
        </button>
        <button
          type="button"
          disabled={pending || !name.trim()}
          onClick={createEmpty}
          className="rounded border border-edge px-4 py-2 text-sm text-silver hover:bg-panel disabled:opacity-50"
        >
          Start empty
        </button>
      </div>

      {pending && <p className="text-sm text-muted">Working…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
