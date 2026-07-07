"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ThreadKind } from "@hyakuto/cms-core";
import {
  createDay, createSegment, createThread, deleteDay, deleteSegment, deleteThread, moveSegment,
  type ActionResult, type CreateResult,
} from "@/app/actions";

// The Day → Thread → Segment tree. Structure only — ids are minted server-side,
// content is edited in the segment grid. Days on the left, threads on the right;
// a segment is created *into* a day, in a thread (or thread-less = system).

export interface DayInfo { id: string; index: number; route: string; segmentIds: string[] }
export interface SegmentInfo { threadId: string | null; lineCount: number }
export interface ThreadInfo { id: string; kind: ThreadKind; name: string; contact: string | null; segmentCount: number }

const input =
  "rounded border border-edge bg-ink px-2 py-1 text-sm text-silver outline-none focus:border-gold/60";
const chip = "rounded border border-edge px-2 py-1 text-xs text-muted hover:bg-panel disabled:opacity-50";

const KIND_LABEL: Record<ThreadKind | "system", string> = {
  group_chat: "group", dm: "dm", vn: "vn", system: "system",
};

/** Small two-step destructive button (same pattern as DeleteGame/ImportDemo). */
function Confirm({ label, onConfirm, disabled }: { label: string; onConfirm: () => void; disabled?: boolean }) {
  const [arming, setArming] = useState(false);
  const arm = () => setArming(true);
  const disarm = () => setArming(false);
  const fire = () => { setArming(false); onConfirm(); };
  if (!arming)
    return (
      <button type="button" disabled={disabled} onClick={arm} className="text-xs text-muted hover:text-danger disabled:opacity-40">
        {label}
      </button>
    );
  return (
    <span className="flex items-center gap-2 text-xs">
      <button type="button" onClick={fire} className="text-danger hover:underline">confirm</button>
      <button type="button" onClick={disarm} className="text-muted hover:text-silver">cancel</button>
    </span>
  );
}

export function StoryTree({ gameId, days, segments, threads, characters }: {
  gameId: string;
  days: DayInfo[];
  segments: Record<string, SegmentInfo>;
  threads: ThreadInfo[];
  characters: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // New-thread form.
  const [threadName, setThreadName] = useState("");
  const [threadKind, setThreadKind] = useState<ThreadKind>("group_chat");
  const [threadContact, setThreadContact] = useState("");

  // New-day route (defaults to the last route in use).
  const [route, setRoute] = useState(days.at(-1)?.route ?? "main");

  // Per-day thread picker for "+ segment" ("" = system).
  const [segThread, setSegThread] = useState<Record<string, string>>({});

  const threadById = new Map(threads.map((t) => [t.id, t]));

  /** Run an action; surface its error or refresh the tree. */
  const run = (action: () => Promise<ActionResult | CreateResult>, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) setError(result.error);
      else {
        after?.();
        router.refresh();
      }
    });

  const addSegmentTo = (dayId: string) => () =>
    startTransition(async () => {
      setError(null);
      const threadId = segThread[dayId] || undefined;
      const result = await createSegment(gameId, dayId, threadId);
      if (!result.ok) setError(result.error);
      else router.push(`/g/${gameId}/story/${result.id}`); // jump straight into the grid
    });

  // Named per-row handler factories — JSX passes their call results, never lambdas.
  const moveSegmentIn = (dayId: string, segId: string, dir: -1 | 1) => () =>
    run(() => moveSegment(gameId, dayId, segId, dir));
  const deleteSegmentIn = (segId: string) => () => run(() => deleteSegment(gameId, segId));
  const deleteDayIn = (dayId: string) => () => run(() => deleteDay(gameId, dayId));
  const deleteThreadIn = (threadId: string) => () => run(() => deleteThread(gameId, threadId));
  const pickSegThread = (dayId: string) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setSegThread((m) => ({ ...m, [dayId]: e.target.value }));
  const editRoute = (e: React.ChangeEvent<HTMLInputElement>) => setRoute(e.target.value);
  const addDay = () => run(() => createDay(gameId, route));
  const editThreadName = (e: React.ChangeEvent<HTMLInputElement>) => setThreadName(e.target.value);
  const pickThreadKind = (e: React.ChangeEvent<HTMLSelectElement>) => setThreadKind(e.target.value as ThreadKind);
  const pickThreadContact = (e: React.ChangeEvent<HTMLSelectElement>) => setThreadContact(e.target.value);
  const submitThread = () =>
    run(
      () => createThread(gameId, { name: threadName, kind: threadKind, contact: threadContact || undefined }),
      () => { setThreadName(""); setThreadContact(""); },
    );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-silver">Story</h2>
          <p className="text-xs text-muted">Days hold segments in play order; each segment belongs to a thread (or is a system segment).</p>
        </div>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        {/* ── Days ── */}
        <div className="space-y-4">
          {days.length === 0 && <p className="text-sm text-muted">No days yet — add day 1 to start.</p>}
          {days.map((day) => (
            <div key={day.id} className="space-y-2 rounded border border-edge bg-panel/40 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-silver">
                  Day {day.index} <span className="text-xs text-muted">· {day.route}</span>
                </h3>
                {day.segmentIds.length === 0 && (
                  <Confirm label="delete day" disabled={pending} onConfirm={deleteDayIn(day.id)} />
                )}
              </div>

              <div className="space-y-1.5">
                {day.segmentIds.map((segId, i) => {
                  const seg = segments[segId];
                  const thread = seg?.threadId ? threadById.get(seg.threadId) : undefined;
                  return (
                    <div key={segId} className="flex items-center gap-2 rounded border border-edge bg-ink/60 px-2 py-1.5">
                      <span className="flex flex-col leading-none">
                        <button type="button" disabled={pending || i === 0} onClick={moveSegmentIn(day.id, segId, -1)}
                          className="text-[10px] text-muted hover:text-silver disabled:opacity-30" aria-label="move up">▲</button>
                        <button type="button" disabled={pending || i === day.segmentIds.length - 1} onClick={moveSegmentIn(day.id, segId, 1)}
                          className="text-[10px] text-muted hover:text-silver disabled:opacity-30" aria-label="move down">▼</button>
                      </span>
                      <span className="rounded bg-panel px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                        {KIND_LABEL[thread?.kind ?? "system"]}
                      </span>
                      <Link href={`/g/${gameId}/story/${segId}`} className="text-sm text-silver hover:text-gold">
                        {segId}
                      </Link>
                      {thread && <span className="text-xs text-muted">· {thread.name}</span>}
                      <span className="ml-auto text-xs text-muted/70">{seg?.lineCount ?? 0} lines</span>
                      <Confirm label="delete" disabled={pending} onConfirm={deleteSegmentIn(segId)} />
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <select
                  className={input}
                  value={segThread[day.id] ?? ""}
                  onChange={pickSegThread(day.id)}
                >
                  <option value="">system (no thread)</option>
                  {threads.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({KIND_LABEL[t.kind]})</option>
                  ))}
                </select>
                <button type="button" disabled={pending} onClick={addSegmentTo(day.id)} className={chip}>
                  + segment
                </button>
              </div>
            </div>
          ))}

          <div className="flex items-center gap-2">
            <input className={`${input} w-32`} placeholder="route" value={route} onChange={editRoute} />
            <button type="button" disabled={pending} onClick={addDay} className={chip}>
              + add day
            </button>
          </div>
        </div>

        {/* ── Threads ── */}
        <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
          <h3 className="text-sm font-medium text-silver">Threads</h3>
          <div className="space-y-1.5">
            {threads.length === 0 && <p className="text-xs text-muted">No threads yet.</p>}
            {threads.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded border border-edge bg-panel/40 px-2 py-1.5">
                <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">{KIND_LABEL[t.kind]}</span>
                <span className="text-sm text-silver">{t.name}</span>
                {t.contact && <span className="text-xs text-muted">@{t.contact}</span>}
                <span className="ml-auto text-xs text-muted/70">{t.segmentCount}</span>
                <Confirm label="✕" disabled={pending || t.segmentCount > 0} onConfirm={deleteThreadIn(t.id)} />
              </div>
            ))}
          </div>

          <div className="space-y-2 rounded border border-edge bg-panel/40 p-3">
            <p className="text-xs text-muted">New thread</p>
            <input className={`${input} w-full`} placeholder="name" value={threadName} onChange={editThreadName} />
            <div className="flex gap-2">
              <select className={input} value={threadKind} onChange={pickThreadKind}>
                <option value="group_chat">group chat</option>
                <option value="dm">dm</option>
                <option value="vn">vn</option>
              </select>
              {threadKind === "dm" && (
                <select className={`${input} flex-1`} value={threadContact} onChange={pickThreadContact}>
                  <option value="">contact…</option>
                  {characters.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
            <button
              type="button"
              disabled={pending || !threadName.trim()}
              onClick={submitThread}
              className={chip}
            >
              + add thread
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
