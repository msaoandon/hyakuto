"use client";

import { useState, useTransition } from "react";
import { initProject } from "@/app/actions";

// Shown when no project exists yet. Bootstraps either from today's demo (exercising
// the importer) or an empty project. Both go through the initProject server action.
export function InitProject() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (mode: "demo" | "empty") =>
    startTransition(async () => {
      setError(null);
      const result = await initProject(mode);
      if (!result.ok) setError(result.error);
    });

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-medium text-silver">No project yet</h2>
        <p className="text-sm text-muted">
          Create one to start authoring. Importing the demo migrates the current
          <code className="mx-1 rounded bg-panel px-1 text-gold">apps/web</code> content into the project model.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => run("demo")}
          className="rounded border border-gold/60 bg-gold/10 px-4 py-2 text-sm text-gold hover:bg-gold/20 disabled:opacity-50"
        >
          Import current demo
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("empty")}
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
