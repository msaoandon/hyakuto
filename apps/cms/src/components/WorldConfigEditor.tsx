"use client";

import { useMemo, useState, useTransition } from "react";
import type { WorldConfigT, WorkspaceT } from "@hyakuto/cms-core";
import { saveWorld } from "@/app/actions";

// The world config editor (DEV_PLAN_CMS §VI.2). Edits the single source that
// *generates* gameConfig and drives every dropdown elsewhere in the CMS — so
// config drift and wrong axis/character names become unrepresentable. Local state
// is the working copy; Save validates + persists through the server action.

const input =
  "rounded border border-edge bg-ink px-2 py-1 text-sm text-silver outline-none focus:border-gold/60";
const chip = "rounded border border-edge px-2 py-1 text-xs text-muted hover:bg-panel";

// Advisory client-side mirror of cms-core's compileGameConfig (kept inline so the
// node-only store never enters the client bundle). The authoritative generation
// runs server-side at compile.
function previewGameConfig(world: WorldConfigT) {
  return {
    axes: world.axes.map((a) => a.id),
    characters: world.characters.map((c) => ({ id: c.id, typing_rate: c.typing_rate })),
    counters: world.counters.map((c) => ({
      id: c.id, start: c.start, end: c.end, direction: c.direction,
      ...(c.tiers ? { tiers: c.tiers } : {}),
      ...(c.on_complete ? { on_complete: c.on_complete } : {}),
    })),
  };
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

export function WorldConfigEditor({ workspace, world: initial }: { workspace: WorkspaceT; world: WorldConfigT }) {
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
      const result = await saveWorld(world);
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

        <Section
          title="Scenes"
          hint="VN background scenes, referenced by a segment's scene and scene cues."
          onAdd={() => set("scenes", [...world.scenes, { id: "" }])}
        >
          {world.scenes.map((s, i) => (
            <Row key={i} onRemove={() => set("scenes", removeAt(world.scenes, i))}>
              <input
                className={input} placeholder="id" value={s.id}
                onChange={(e) => set("scenes", editAt(world.scenes, i, { id: e.target.value }))}
              />
              <input
                className={input} placeholder="file (optional)" value={s.file ?? ""}
                onChange={(e) => set("scenes", editAt(world.scenes, i, { file: e.target.value || undefined }))}
              />
            </Row>
          ))}
        </Section>

        <Section
          title="Music themes"
          hint="OST themes a thread's ost / music cue can reference."
          onAdd={() => set("musicThemes", [...world.musicThemes, { id: "" }])}
        >
          {world.musicThemes.map((m, i) => (
            <Row key={i} onRemove={() => set("musicThemes", removeAt(world.musicThemes, i))}>
              <input
                className={input} placeholder="id" value={m.id}
                onChange={(e) => set("musicThemes", editAt(world.musicThemes, i, { id: e.target.value }))}
              />
            </Row>
          ))}
        </Section>
      </div>

      <aside className="space-y-2 lg:sticky lg:top-6 lg:self-start">
        <h3 className="text-sm font-medium text-silver">Generated gameConfig</h3>
        <p className="text-xs text-muted">Live preview of what compile() emits from this world.</p>
        <pre className="max-h-[70vh] overflow-auto rounded border border-edge bg-ink p-3 text-xs text-muted">
          {JSON.stringify(preview, null, 2)}
        </pre>
      </aside>
    </div>
  );
}
