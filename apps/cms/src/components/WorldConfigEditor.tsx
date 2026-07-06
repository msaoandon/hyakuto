"use client";

import { useMemo, useState, useTransition } from "react";
import { compileGameConfig, type WorldConfigT, type WorkspaceT } from "@hyakuto/cms-core";
import { saveWorld } from "@/app/actions";

// The world config editor (DEV_PLAN_CMS §VI.2). Edits the single source that
// *generates* gameConfig and drives every dropdown elsewhere in the CMS — so
// config drift and wrong axis/character names become unrepresentable. Local state
// is the working copy; Save validates + persists through the server action.

const input =
  "rounded border border-edge bg-ink px-2 py-1 text-sm text-silver outline-none focus:border-gold/60";
const chip = "rounded border border-edge px-2 py-1 text-xs text-muted hover:bg-panel";

// The preview runs the *actual* cms-core projection (the node-only store lives
// behind the `/store` subpath, so importing it here is client-safe): what the
// editor shows and what compile() emits are literally the same function. It
// throws on an invalid world (e.g. a blank id) — surfaced as a preview error.
function previewGameConfig(world: WorldConfigT) {
  try {
    return { ok: true as const, config: compileGameConfig(world) };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

function Section({ title, hint, onAdd, children }: {
  title: string; hint?: string; onAdd: () => void; children: React.ReactNode;
}) {
  return (
    <section className="space-y-2 rounded border border-edge bg-panel/40 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-silver">{title}</h3>
          {hint && <p className="text-xs text-muted">{hint}</p>}
        </div>
        <button type="button" onClick={onAdd} className={chip}>+ add</button>
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Row({ onRemove, children }: { onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}
      <button type="button" onClick={onRemove} className="ml-auto text-xs text-muted hover:text-danger">
        remove
      </button>
    </div>
  );
}

export function WorldConfigEditor({ gameId, workspace, world: initial }: { gameId: string; workspace: WorkspaceT; world: WorldConfigT }) {
  const [world, setWorld] = useState<WorldConfigT>(initial);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const preview = useMemo(() => previewGameConfig(world), [world]);

  // Immutable list helpers keyed by world field.
  function set<K extends keyof WorldConfigT>(key: K, value: WorldConfigT[K]) {
    setWorld((w) => ({ ...w, [key]: value }));
    setStatus(null);
  }
  const editAt = <T,>(arr: T[], i: number, patch: Partial<T>): T[] =>
    arr.map((x, j) => (j === i ? { ...x, ...patch } : x));
  const removeAt = <T,>(arr: T[], i: number): T[] => arr.filter((_, j) => j !== i);

  const save = () =>
    startTransition(async () => {
      const result = await saveWorld(gameId, world);
      setStatus(result.ok ? { ok: true, msg: "Saved." } : { ok: false, msg: result.error });
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-silver">World config</h2>
            <p className="text-xs text-muted">
              {workspace.name} · locales: {workspace.locales.join(", ")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {status && (
              <span className={status.ok ? "text-xs text-gold" : "text-xs text-danger"}>{status.msg}</span>
            )}
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

        <Section
          title="Characters"
          hint="Generates gameConfig.characters. id must match the names used in content."
          onAdd={() => set("characters", [...world.characters, { id: "", typing_rate: 1 }])}
        >
          {world.characters.map((c, i) => (
            <Row key={i} onRemove={() => set("characters", removeAt(world.characters, i))}>
              <input
                className={input} placeholder="id" value={c.id}
                onChange={(e) => set("characters", editAt(world.characters, i, { id: e.target.value }))}
              />
              <label className="text-xs text-muted">typing rate</label>
              <input
                className={`${input} w-20`} type="number" step="0.1" value={c.typing_rate}
                onChange={(e) => set("characters", editAt(world.characters, i, { typing_rate: Number(e.target.value) }))}
              />
            </Row>
          ))}
        </Section>

        <Section
          title="Affinity axes"
          hint="Generates gameConfig.axes. Referenced by effects and conditions."
          onAdd={() => set("axes", [...world.axes, { id: "" }])}
        >
          {world.axes.map((a, i) => (
            <Row key={i} onRemove={() => set("axes", removeAt(world.axes, i))}>
              <input
                className={input} placeholder="id" value={a.id}
                onChange={(e) => set("axes", editAt(world.axes, i, { id: e.target.value }))}
              />
            </Row>
          ))}
        </Section>

        <Section
          title="Counters"
          hint="Generates gameConfig.counters (e.g. candles)."
          onAdd={() => set("counters", [...world.counters, { id: "", start: 0, end: 0, direction: "down" }])}
        >
          {world.counters.map((c, i) => (
            <Row key={i} onRemove={() => set("counters", removeAt(world.counters, i))}>
              <input
                className={input} placeholder="id" value={c.id}
                onChange={(e) => set("counters", editAt(world.counters, i, { id: e.target.value }))}
              />
              <label className="text-xs text-muted">start</label>
              <input
                className={`${input} w-16`} type="number" value={c.start}
                onChange={(e) => set("counters", editAt(world.counters, i, { start: Number(e.target.value) }))}
              />
              <label className="text-xs text-muted">end</label>
              <input
                className={`${input} w-16`} type="number" value={c.end}
                onChange={(e) => set("counters", editAt(world.counters, i, { end: Number(e.target.value) }))}
              />
              <select
                className={input} value={c.direction}
                onChange={(e) => set("counters", editAt(world.counters, i, { direction: e.target.value as "up" | "down" }))}
              >
                <option value="down">down</option>
                <option value="up">up</option>
              </select>
            </Row>
          ))}
        </Section>

        <Section
          title="Flags"
          hint="Boolean story flags referenced by flag: conditions."
          onAdd={() => set("flags", [...world.flags, { id: "" }])}
        >
          {world.flags.map((f, i) => (
            <Row key={i} onRemove={() => set("flags", removeAt(world.flags, i))}>
              <input
                className={input} placeholder="id" value={f.id}
                onChange={(e) => set("flags", editAt(world.flags, i, { id: e.target.value }))}
              />
            </Row>
          ))}
        </Section>

        <Section
          title="Cue channels"
          hint="Channels a cue line can target (music, glitch, scene)."
          onAdd={() => set("cueChannels", [...world.cueChannels, { id: "" }])}
        >
          {world.cueChannels.map((c, i) => (
            <Row key={i} onRemove={() => set("cueChannels", removeAt(world.cueChannels, i))}>
              <input
                className={input} placeholder="id" value={c.id}
                onChange={(e) => set("cueChannels", editAt(world.cueChannels, i, { id: e.target.value }))}
              />
            </Row>
          ))}
        </Section>

        <p className="text-xs text-muted/70">
          VN scenes are authored with their segments in{" "}
          <a href={`/g/${gameId}/story`} className="text-gold hover:underline">Story</a>; OST tracks live in the{" "}
          <a href={`/g/${gameId}/ost`} className="text-gold hover:underline">OST</a> section.
        </p>
      </div>

      <aside className="space-y-2 lg:sticky lg:top-6 lg:self-start">
        <h3 className="text-sm font-medium text-silver">Generated gameConfig</h3>
        <p className="text-xs text-muted">Live preview of what compile() emits from this world.</p>
        {preview.ok ? (
          <pre className="max-h-[70vh] overflow-auto rounded border border-edge bg-ink p-3 text-xs text-muted">
            {JSON.stringify(preview.config, null, 2)}
          </pre>
        ) : (
          <p className="rounded border border-danger/40 bg-danger/10 p-3 text-xs text-danger">{preview.error}</p>
        )}
      </aside>
    </div>
  );
}
