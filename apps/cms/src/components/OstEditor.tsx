"use client";

import { useState, useTransition } from "react";
import type { MusicThemeDefT } from "@hyakuto/cms-core";
import { saveMusicThemes } from "@/app/actions";

// The OST section (separate from initial world setup). You name/organize tracks
// here — the `id` is what content refs (a thread's ost, a music cue) point at; the
// `name` is the author-facing label. Audio file upload is the next step; the `file`
// slot already exists on the model.

const input =
  "rounded border border-edge bg-ink px-2 py-1 text-sm text-silver outline-none focus:border-gold/60";

export function OstEditor({ gameId, themes: initial }: { gameId: string; themes: MusicThemeDefT[] }) {
  const [themes, setThemes] = useState<MusicThemeDefT[]>(initial);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const update = (next: MusicThemeDefT[]) => {
    setThemes(next);
    setStatus(null);
  };
  const editAt = (i: number, patch: Partial<MusicThemeDefT>) =>
    update(themes.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const save = () =>
    startTransition(async () => {
      const result = await saveMusicThemes(gameId, themes);
      setStatus(result.ok ? { ok: true, msg: "Saved." } : { ok: false, msg: result.error });
    });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-silver">OST</h2>
          <p className="text-xs text-muted">
            Name the tracks the game references. <code className="text-gold">id</code> is used in content
            (thread ost / music cue); <code className="text-gold">name</code> is your label. Audio upload — next step.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status && <span className={status.ok ? "text-xs text-gold" : "text-xs text-danger"}>{status.msg}</span>}
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded border border-gold/60 bg-gold/10 px-4 py-2 text-sm text-gold hover:bg-gold/20 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {themes.length === 0 && <p className="text-sm text-muted">No tracks yet.</p>}
        {themes.map((t, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded border border-edge bg-panel/40 p-2">
            <input
              className={input} placeholder="id" value={t.id}
              onChange={(e) => editAt(i, { id: e.target.value })}
            />
            <input
              className={`${input} flex-1`} placeholder="name (optional)" value={t.name ?? ""}
              onChange={(e) => editAt(i, { name: e.target.value || undefined })}
            />
            <span className="text-xs text-muted/70">{t.file ?? "no audio yet"}</span>
            <button
              type="button"
              onClick={() => update(themes.filter((_, j) => j !== i))}
              className="ml-auto text-xs text-muted hover:text-danger"
            >
              remove
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => update([...themes, { id: "" }])}
        className="rounded border border-edge px-3 py-1.5 text-xs text-muted hover:bg-panel"
      >
        + add track
      </button>
    </section>
  );
}
