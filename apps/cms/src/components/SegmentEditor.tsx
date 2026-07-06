"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  editUnitText, newUnit, nextChildId, nextLineId,
  type EffectRef, type LineT, type SegmentT, type ThreadKind, type TranslatableUnitT, type WorldConfigT,
} from "@hyakuto/cms-core";
import { addScene, saveSegment } from "@/app/actions";

// The segment authoring grid (DEV_PLAN_CMS §VI.3): a typed, spreadsheet-like view
// over the normalized model. Everything referential is a dropdown fed by the world
// config (characters, axes/counters, cue channels, scenes) so `ko`-vs-`kou` typos
// are unrepresentable; every id is minted by cms-core's managed-id helpers, never
// typed; edits autosave through the saveSegment action (validated server-side).
//
// Keyboard: Enter appends a row below (message on main fields; option/variant on
// sub-rows) · ↑/↓ move between rows · Alt+↑/↓ reorder · ⌘/Ctrl+Backspace deletes.

type Choice = Extract<LineT, { type: "choice" }>;
type Pool = Extract<LineT, { type: "pool" }>;
type Cue = Extract<LineT, { type: "cue" }>;

const input =
  "rounded border border-edge bg-ink px-2 py-1 text-sm text-silver outline-none focus:border-gold/60";
const tinyBtn = "text-xs text-muted hover:text-silver disabled:opacity-30";
const chip = "rounded border border-edge px-2 py-1 text-xs text-muted hover:bg-panel disabled:opacity-40";

const KIND_LABEL: Record<ThreadKind | "system", string> = {
  group_chat: "group chat", dm: "dm", vn: "vn", system: "system",
};

type SaveStatus =
  | { kind: "saved" } | { kind: "dirty" } | { kind: "saving" } | { kind: "error"; message: string };

// ── small shared controls ─────────────────────────────────────────────────────

function CharacterSelect({ value, characters, allowMC, onChange }: {
  value: string | undefined; characters: string[]; allowMC?: boolean; onChange: (v: string | undefined) => void;
}) {
  return (
    <select className={input} value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
      {allowMC && <option value="">MC (player)</option>}
      {value && !characters.includes(value) && <option value={value}>{value} (unknown!)</option>}
      {characters.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

/** Structured effect entry: axis/counter dropdown + integer delta — never typed. */
function EffectsEditor({ effects, targets, onChange }: {
  effects: EffectRef[] | undefined; targets: string[]; onChange: (next: EffectRef[] | undefined) => void;
}) {
  const list = effects ?? [];
  const edit = (i: number, patch: Partial<EffectRef>) =>
    onChange(list.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  return (
    <span className="flex flex-wrap items-center gap-1">
      {list.map((e, i) => (
        <span key={i} className="flex items-center gap-1 rounded border border-edge bg-ink px-1 py-0.5">
          <select className="bg-ink text-xs text-silver outline-none" value={e.target}
            onChange={(ev) => edit(i, { target: ev.target.value })}>
            {!targets.includes(e.target) && <option value={e.target}>{e.target} (unknown!)</option>}
            {targets.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="number" step={1} className="w-12 bg-ink text-xs text-silver outline-none" value={e.delta}
            onChange={(ev) => edit(i, { delta: Math.trunc(Number(ev.target.value)) })} />
          <button type="button" className={tinyBtn} onClick={() => {
            const next = list.filter((_, j) => j !== i);
            onChange(next.length ? next : undefined);
          }}>✕</button>
        </span>
      ))}
      <button type="button" disabled={targets.length === 0} className={tinyBtn}
        title={targets.length ? "add effect" : "define axes/counters in World config first"}
        onClick={() => onChange([...list, { target: targets[0], delta: 1 }])}>
        +fx
      </button>
    </span>
  );
}

function ConditionInput({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  return (
    <input
      className={`${input} w-36 font-mono text-xs`} placeholder="condition"
      value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}
    />
  );
}

/** Scene dropdown + inline "new scene" (scenes are minted here — their natural
 *  authoring moment — and land in world.scenes via the addScene action). */
function ScenePicker({ gameId, scenes, value, onChange }: {
  gameId: string; scenes: string[]; value: string | undefined; onChange: (v: string | undefined) => void;
}) {
  const [minted, setMinted] = useState<string[]>([]);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const all = [...new Set([...scenes, ...minted])];

  const commit = async () => {
    const id = (draft ?? "").trim();
    if (!id) return setDraft(null);
    const result = await addScene(gameId, id);
    if (!result.ok) return setError(result.error);
    setMinted((m) => [...m, id]);
    onChange(id);
    setDraft(null);
    setError(null);
  };

  if (draft !== null)
    return (
      <span className="flex items-center gap-1">
        <input autoFocus className={`${input} w-32`} placeholder="scene id" value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void commit(); } if (e.key === "Escape") setDraft(null); }} />
        <button type="button" className={tinyBtn} onClick={() => void commit()}>ok</button>
        {error && <span className="text-xs text-danger">{error}</span>}
      </span>
    );

  return (
    <span className="flex items-center gap-1">
      <select className={input} value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">— no scene —</option>
        {value && !all.includes(value) && <option value={value}>{value} (unknown!)</option>}
        {all.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <button type="button" className={tinyBtn} onClick={() => setDraft("")}>+ new</button>
    </span>
  );
}

/** Cue value control, typed by channel: music → OST dropdown, scene → scene
 *  picker, anything else → free text. */
function CueValue({ gameId, line, world, onChange }: {
  gameId: string; line: Cue; world: WorldConfigT; onChange: (value: string) => void;
}) {
  if (line.channel === "music") {
    const themes = world.musicThemes.map((t) => t.id);
    return (
      <select className={input} value={line.value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— off —</option>
        {line.value && !themes.includes(line.value) && <option value={line.value}>{line.value} (unknown!)</option>}
        {themes.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    );
  }
  if (line.channel === "scene")
    return (
      <ScenePicker gameId={gameId} scenes={world.scenes.map((s) => s.id)} value={line.value || undefined}
        onChange={(v) => onChange(v ?? "")} />
    );
  return <input className={`${input} w-32`} placeholder="value" value={line.value} onChange={(e) => onChange(e.target.value)} />;
}

/** Amber marker when a source edit left translations stale (§III.5). */
function StaleMark({ unit }: { unit: TranslatableUnitT }) {
  if (!unit.staleLocales?.length) return null;
  return (
    <span className="text-xs text-gold" title={`Stale translations: ${unit.staleLocales.join(", ")}`}>●</span>
  );
}

// ── the editor ────────────────────────────────────────────────────────────────

export function SegmentEditor({ gameId, segment: initial, defaultLocale: dl, world, context }: {
  gameId: string;
  segment: SegmentT;
  defaultLocale: string;
  world: WorldConfigT;
  context: { kind: ThreadKind | "system"; threadName: string | null; dayLabel: string };
}) {
  const [segment, setSegment] = useState<SegmentT>(initial);
  const [status, setStatus] = useState<SaveStatus>({ kind: "saved" });

  const characters = world.characters.map((c) => c.id);
  const hasCharacters = characters.length > 0;
  const effectTargets = [...world.axes.map((a) => a.id), ...world.counters.map((c) => c.id)];

  // ── autosave: debounce every state change into one validated saveSegment ──
  const seq = useRef(0);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setStatus({ kind: "dirty" });
    const timer = setTimeout(async () => {
      const mine = ++seq.current;
      setStatus({ kind: "saving" });
      const result = await saveSegment(gameId, segment);
      if (seq.current !== mine) return; // a newer save is in flight — let it report
      setStatus(result.ok ? { kind: "saved" } : { kind: "error", message: result.error });
    }, 700);
    return () => clearTimeout(timer);
  }, [segment, gameId]);

  // Unsaved work must never vanish silently on a closed tab.
  useEffect(() => {
    if (status.kind === "saved") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status.kind]);

  // ── line operations (ids minted by cms-core, never typed) ──
  const allIds = () =>
    segment.lines.flatMap((l) => [
      l.id,
      ...(l.type === "choice" ? l.options.map((o) => o.id) : []),
      ...(l.type === "pool" ? l.variants.map((v) => v.id) : []),
    ]);

  const setLines = (lines: LineT[]) => setSegment((s) => ({ ...s, lines }));
  const replaceLine = (next: LineT) => setLines(segment.lines.map((l) => (l.id === next.id ? next : l)));

  // Focus follows structural edits: register primary inputs by id, focus after render.
  const inputs = useRef(new Map<string, HTMLInputElement | HTMLSelectElement>());
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingFocus.current) return;
    inputs.current.get(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });
  const register = (id: string) => (el: HTMLInputElement | HTMLSelectElement | null) => {
    if (el) inputs.current.set(id, el);
    else inputs.current.delete(id);
  };

  /** The character a new message row continues with: the row above's, else the last used, else the first defined. */
  const continuationCharacter = (beforeIndex: number): string => {
    for (let i = beforeIndex; i >= 0; i--) {
      const l = segment.lines[i];
      if ("character" in l && l.character) return l.character;
    }
    return characters[0] ?? "";
  };

  const makeLine = (type: LineT["type"], id: string, character: string): LineT => {
    switch (type) {
      case "message": return { type, id, character, text: newUnit(id, dl) };
      case "status": return { type, id, text: newUnit(id, dl) };
      case "sticker":
      case "image": return { type, id, character, file: "" };
      case "pool": return { type, id, character, variants: [{ id: `${id}__v0`, text: newUnit(`${id}__v0`, dl), weight: 1 }] };
      case "choice": return { type, id, options: [{ id: `${id}__o0`, text: newUnit(`${id}__o0`, dl) }] };
      case "cue": return { type, id, channel: world.cueChannels[0]?.id ?? "music", value: "" };
      case "typing": return { type, id, character };
    }
  };

  const addLine = (type: LineT["type"], afterId?: string) => {
    const id = nextLineId(segment.id, allIds());
    const at = afterId ? segment.lines.findIndex((l) => l.id === afterId) : segment.lines.length - 1;
    const line = makeLine(type, id, continuationCharacter(at));
    setLines([...segment.lines.slice(0, at + 1), line, ...segment.lines.slice(at + 1)]);
    pendingFocus.current = type === "choice" ? `${id}__o0` : type === "pool" ? `${id}__v0` : id;
  };

  const moveLine = (id: string, dir: -1 | 1) => {
    const i = segment.lines.findIndex((l) => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= segment.lines.length) return;
    const lines = [...segment.lines];
    [lines[i], lines[j]] = [lines[j], lines[i]];
    setLines(lines);
    pendingFocus.current = id;
  };

  const removeLine = (id: string) => {
    const i = segment.lines.findIndex((l) => l.id === id);
    pendingFocus.current = segment.lines[i - 1]?.id ?? segment.lines[i + 1]?.id ?? null;
    setLines(segment.lines.filter((l) => l.id !== id));
  };

  /** Focus the nearest registered input from `from`, walking `dir`. */
  const focusRow = (from: number, dir: -1 | 1) => {
    for (let i = from; i >= 0 && i < segment.lines.length; i += dir) {
      const target = segment.lines[i];
      const id = target.type === "choice" ? target.options[0]?.id : target.type === "pool" ? target.variants[0]?.id : target.id;
      if (id && inputs.current.has(id)) { inputs.current.get(id)?.focus(); return; }
    }
  };

  const rowKeys = (lineId: string) => (e: React.KeyboardEvent) => {
    const i = segment.lines.findIndex((l) => l.id === lineId);
    if (e.key === "Enter") { e.preventDefault(); addLine(hasCharacters ? "message" : "status", lineId); }
    else if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); moveLine(lineId, -1); }
    else if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); moveLine(lineId, 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); focusRow(i - 1, -1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); focusRow(i + 1, 1); }
    else if (e.key === "Backspace" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); removeLine(lineId); }
  };

  // ── per-type row bodies ──
  const textOf = (u: TranslatableUnitT) => u.text[dl] ?? "";

  function rowBody(line: LineT): React.ReactNode {
    switch (line.type) {
      case "message":
        return (
          <>
            <CharacterSelect value={line.character} characters={characters}
              onChange={(v) => replaceLine({ ...line, character: v ?? "" })} />
            <input ref={register(line.id)} className={`${input} min-w-40 flex-1`} placeholder="message text"
              value={textOf(line.text)} onKeyDown={rowKeys(line.id)}
              onChange={(e) => replaceLine({ ...line, text: editUnitText(line.text, e.target.value, dl) })} />
            <StaleMark unit={line.text} />
            <EffectsEditor effects={line.effects} targets={effectTargets}
              onChange={(effects) => replaceLine({ ...line, effects })} />
            <ConditionInput value={line.condition} onChange={(condition) => replaceLine({ ...line, condition })} />
          </>
        );
      case "status":
        return (
          <>
            <input ref={register(line.id)} className={`${input} min-w-40 flex-1`} placeholder="status text"
              value={textOf(line.text)} onKeyDown={rowKeys(line.id)}
              onChange={(e) => replaceLine({ ...line, text: editUnitText(line.text, e.target.value, dl) })} />
            <StaleMark unit={line.text} />
            <ConditionInput value={line.condition} onChange={(condition) => replaceLine({ ...line, condition })} />
          </>
        );
      case "sticker":
      case "image":
        return (
          <>
            <CharacterSelect value={line.character} characters={characters}
              onChange={(v) => replaceLine({ ...line, character: v ?? "" })} />
            <input ref={register(line.id)} className={`${input} min-w-40 flex-1`}
              placeholder={`${line.type} file (asset upload — later step)`}
              value={line.file} onKeyDown={rowKeys(line.id)}
              onChange={(e) => replaceLine({ ...line, file: e.target.value })} />
            <EffectsEditor effects={line.effects} targets={effectTargets}
              onChange={(effects) => replaceLine({ ...line, effects })} />
            <ConditionInput value={line.condition} onChange={(condition) => replaceLine({ ...line, condition })} />
          </>
        );
      case "typing":
        return (
          <CharacterSelect value={line.character} characters={characters}
            onChange={(v) => replaceLine({ ...line, character: v ?? "" })} />
        );
      case "cue":
        return (
          <>
            <select ref={register(line.id)} className={input} value={line.channel} onKeyDown={rowKeys(line.id)}
              onChange={(e) => replaceLine({ ...line, channel: e.target.value, value: "" })}>
              {!world.cueChannels.some((c) => c.id === line.channel) && (
                <option value={line.channel}>{line.channel} (unknown!)</option>
              )}
              {world.cueChannels.map((c) => <option key={c.id} value={c.id}>{c.id}</option>)}
            </select>
            <CueValue gameId={gameId} line={line} world={world} onChange={(value) => replaceLine({ ...line, value })} />
            <ConditionInput value={line.condition} onChange={(condition) => replaceLine({ ...line, condition })} />
          </>
        );
      case "pool":
        return poolBody(line);
      case "choice":
        return choiceBody(line);
    }
  }

  function poolBody(line: Pool): React.ReactNode {
    const editVariant = (i: number, patch: Partial<Pool["variants"][number]>) =>
      replaceLine({ ...line, variants: line.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) });
    const addVariant = () => {
      const vid = nextChildId(line.id, "v", line.variants.map((v) => v.id));
      replaceLine({ ...line, variants: [...line.variants, { id: vid, text: newUnit(vid, dl), weight: 1 }] });
      pendingFocus.current = vid;
    };
    return (
      <>
        <CharacterSelect value={line.character} characters={characters}
          onChange={(v) => replaceLine({ ...line, character: v ?? "" })} />
        <div className="flex flex-1 flex-col gap-1">
          {line.variants.map((v, i) => (
            <div key={v.id} className="flex items-center gap-2">
              <input ref={register(v.id)} className={`${input} min-w-40 flex-1`} placeholder={`variant ${i + 1}`}
                value={textOf(v.text)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addVariant(); } }}
                onChange={(e) => editVariant(i, { text: editUnitText(v.text, e.target.value, dl) })} />
              <StaleMark unit={v.text} />
              <label className="text-[10px] text-muted">w</label>
              <input type="number" step={0.5} min={0.5} className={`${input} w-16`} value={v.weight}
                onChange={(e) => editVariant(i, { weight: Number(e.target.value) })} />
              <button type="button" className={tinyBtn} disabled={line.variants.length === 1}
                onClick={() => replaceLine({ ...line, variants: line.variants.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button type="button" className={`${tinyBtn} self-start`} onClick={addVariant}>+ variant</button>
        </div>
        <EffectsEditor effects={line.effects} targets={effectTargets}
          onChange={(effects) => replaceLine({ ...line, effects })} />
        <ConditionInput value={line.condition} onChange={(condition) => replaceLine({ ...line, condition })} />
      </>
    );
  }

  function choiceBody(line: Choice): React.ReactNode {
    const editOption = (i: number, patch: Partial<Choice["options"][number]>) =>
      replaceLine({ ...line, options: line.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
    const addOption = () => {
      const oid = nextChildId(line.id, "o", line.options.map((o) => o.id));
      replaceLine({ ...line, options: [...line.options, { id: oid, text: newUnit(oid, dl) }] });
      pendingFocus.current = oid;
    };
    return (
      <>
        <CharacterSelect value={line.character} characters={characters} allowMC
          onChange={(v) => replaceLine({ ...line, ...(v ? { character: v } : { character: undefined }) })} />
        <div className="flex flex-1 flex-col gap-1">
          {line.options.map((o, i) => (
            <div key={o.id} className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-muted">{String.fromCharCode(65 + i)}</span>
              <input ref={register(o.id)} className={`${input} min-w-40 flex-1`} placeholder={`option ${i + 1}`}
                value={textOf(o.text)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }}
                onChange={(e) => editOption(i, { text: editUnitText(o.text, e.target.value, dl) })} />
              <StaleMark unit={o.text} />
              <EffectsEditor effects={o.effects} targets={effectTargets}
                onChange={(effects) => editOption(i, { effects })} />
              <ConditionInput value={o.condition} onChange={(condition) => editOption(i, { condition })} />
              <button type="button" className={tinyBtn} disabled={line.options.length === 1}
                onClick={() => replaceLine({ ...line, options: line.options.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button type="button" className={`${tinyBtn} self-start`} onClick={addOption}>+ option</button>
        </div>
      </>
    );
  }

  // ── render ──
  const needsCharacters: LineT["type"][] = ["message", "sticker", "image", "pool", "typing"];
  const saveBadge =
    status.kind === "saved" ? <span className="text-xs text-muted">Saved</span> :
    status.kind === "saving" ? <span className="text-xs text-muted">Saving…</span> :
    status.kind === "dirty" ? <span className="text-xs text-muted">…</span> :
    <span className="text-xs text-danger">Not saved: {status.message}</span>;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/g/${gameId}/story`} className="text-xs text-muted hover:text-silver">← Story</Link>
        <h2 className="text-lg font-medium text-silver">{segment.id}</h2>
        <span className="rounded bg-panel px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
          {KIND_LABEL[context.kind]}
        </span>
        {context.threadName && <span className="text-xs text-muted">{context.threadName}</span>}
        <span className="text-xs text-muted/70">· {context.dayLabel}</span>
        <span className="ml-auto">{saveBadge}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded border border-edge bg-panel/40 px-3 py-2">
        {context.kind === "vn" && (
          <span className="flex items-center gap-2">
            <label className="text-xs text-muted">scene</label>
            <ScenePicker gameId={gameId} scenes={world.scenes.map((s) => s.id)} value={segment.scene}
              onChange={(scene) => setSegment((s) => ({ ...s, scene }))} />
          </span>
        )}
        <span className="flex items-center gap-2">
          <label className="text-xs text-muted">segment condition</label>
          <input className={`${input} w-64 font-mono text-xs`} placeholder="e.g. flag:met_oiwa" value={segment.condition ?? ""}
            onChange={(e) => setSegment((s) => ({ ...s, condition: e.target.value || undefined }))} />
        </span>
      </div>

      <div className="space-y-1.5">
        {segment.lines.length === 0 && (
          <p className="text-sm text-muted">Empty segment — add the first line below.</p>
        )}
        {segment.lines.map((line, i) => (
          <div key={line.id} className="flex flex-wrap items-start gap-2 rounded border border-edge bg-panel/30 px-2 py-1.5">
            <span className="flex flex-col leading-none pt-1">
              <button type="button" className="text-[10px] text-muted hover:text-silver disabled:opacity-30"
                disabled={i === 0} onClick={() => moveLine(line.id, -1)} aria-label="move up">▲</button>
              <button type="button" className="text-[10px] text-muted hover:text-silver disabled:opacity-30"
                disabled={i === segment.lines.length - 1} onClick={() => moveLine(line.id, 1)} aria-label="move down">▼</button>
            </span>
            <span className="w-14 pt-1.5 text-[10px] uppercase tracking-wide text-muted" title={line.id}>
              {line.type}
            </span>
            {rowBody(line)}
            <button type="button" className={`${tinyBtn} ml-auto pt-1.5 hover:text-danger`} title="delete row (⌘⌫)"
              onClick={() => removeLine(line.id)}>✕</button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["message", "status", "choice", "pool", "cue", "sticker", "image", "typing"] as const).map((t) => (
          <button key={t} type="button" className={chip}
            disabled={needsCharacters.includes(t) && !hasCharacters}
            onClick={() => addLine(t)}>
            + {t}
          </button>
        ))}
        {!hasCharacters && (
          <span className="text-xs text-muted">
            — add characters in <Link className="text-gold hover:underline" href={`/g/${gameId}/world`}>World config</Link> to
            author character lines
          </span>
        )}
      </div>
    </section>
  );
}
