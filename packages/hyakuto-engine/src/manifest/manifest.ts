import type { Block, StoryFile } from "../schemas/block";
import type { DayConfig } from "../schemas/day";
import type { SegmentInput } from "../engine";
import type { GameState } from "../state/game-state";
import { evaluateCondition } from "../conditions/parser";

// ─── MANIFEST CONTRACT ───────────────────────────────────
// Shapes emitted by the Apps Script exporter (see .claude/AppsScript.md).

/** Per-segment envelope from the `_manifest` tab. */
export type SegmentMeta = {
  id: string;
  type: "group_chat" | "dm" | "vn" | "system";
  route?: string;
  day?: number;
  thread_id?: string;
  scene?: string;
  condition?: string;
};

/** Per-thread (chat) envelope from the `_threads` tab. */
export type ThreadMeta = {
  display_name: string;
  condition?: string;
  ost?: string;
  /** Wall-clock time-of-day ("HH:MM") before which the chat stays locked. */
  unlock_after?: string;
  /** Explicit prerequisite chat; defaults to the previous chat in day order. */
  requires?: string;
};

export type Manifest = {
  days: DayConfig[];
  segments: Record<string, SegmentMeta>;
  threads: Record<string, ThreadMeta>;
};

export type LoadedDay = {
  day: DayConfig;
  segmentsById: Record<string, SegmentInput>;
  meta: Record<string, SegmentMeta>;
};

// ─── NAVIGATION ──────────────────────────────────────────

/** All days in the manifest, in export order. */
export function listDays(manifest: Manifest): DayConfig[] {
  return manifest.days;
}

/** How a playable unit renders: a scrolling chat, or a step-through VN reader. */
export type ThreadKind = "chat" | "vn";

/** A playable unit (thread) on a day, with its render kind. */
export type ThreadEntry = { id: string; display_name: string; kind: ThreadKind };

/**
 * The playable units (threads) on a day, in first-appearance order, deduped.
 * `kind` is derived from the unit's segment `type` (a `vn` segment makes a VN
 * unit; everything else is a chat) — structural, not an authored flag. Content
 * validation enforces that a unit's segments are homogeneous in type.
 */
export function listThreads(manifest: Manifest, day: number): ThreadEntry[] {
  const dayCfg = manifest.days.find((d) => d.day === day);
  const seen = new Set<string>();
  const threads: ThreadEntry[] = [];
  for (const id of dayCfg?.segments ?? []) {
    const meta = manifest.segments[id];
    const tid = meta?.thread_id;
    if (!tid || seen.has(tid)) continue;
    seen.add(tid);
    threads.push({
      id: tid,
      display_name: manifest.threads[tid]?.display_name ?? tid,
      kind: meta?.type === "vn" ? "vn" : "chat",
    });
  }
  return threads;
}

// ─── GATING ──────────────────────────────────────────────

/** A segment plays when it has no gate, or its gate passes against the current state. */
export function isSegmentAvailable(meta: SegmentMeta | undefined, state: GameState): boolean {
  if (!meta?.condition) return true;
  return evaluateCondition(meta.condition, state);
}

// ─── THREAD UNLOCK ───────────────────────────────────────
// A chat unlocks once its prerequisite chat is complete AND a wall-clock time
// has passed, with a paid skip to bypass the wait. The rule is derived from the
// manifest's declared order + structured `unlock_after` — never authored flags.

/** The day-scoped completion key used by the save's `completed` map. */
export function threadKey(day: number, threadId: string): string {
  return `${day}:${threadId}`;
}

/** The chat immediately before `threadId` in the day's order, if any. */
export function previousThread(
  manifest: Manifest,
  day: number,
  threadId: string,
): string | undefined {
  const order = listThreads(manifest, day).map((t) => t.id);
  const i = order.indexOf(threadId);
  return i > 0 ? order[i - 1] : undefined;
}

/** Parse "HH:MM" into minutes-since-midnight; throws (fail-loud) on malformed input. */
function parseTimeOfDay(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) throw new Error(`Malformed unlock_after "${hhmm}" (expected "HH:MM")`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error(`Out-of-range unlock_after "${hhmm}"`);
  return h * 60 + min;
}

/**
 * The concrete instant a chat becomes available, or `null` if its prerequisite
 * isn't complete yet (nothing to anchor to). The time gate is anchored to *when
 * the prerequisite completed*, so it resolves to a stable future timestamp (no
 * next-morning re-lock) that a notification scheduler / paywall countdown can use.
 * `now` is injected so a trusted server clock can replace `Date.now()` later.
 */
export function nextUnlockAt(
  manifest: Manifest,
  day: number,
  threadId: string,
  state: GameState,
  now: number,
): number | null {
  const meta = manifest.threads[threadId];
  const prev = meta?.requires ?? previousThread(manifest, day, threadId);
  const prevAt = prev ? state.completed[threadKey(day, prev)] : undefined;
  if (prev && prevAt === undefined) return null; // prerequisite not done

  if (!meta?.unlock_after) return prevAt ?? now; // no time gate → ready once prereq done

  const anchor = prevAt ?? now; // a first chat with a time gate anchors to now
  const target = parseTimeOfDay(meta.unlock_after);
  const d = new Date(anchor);
  const anchorMinutes = d.getHours() * 60 + d.getMinutes();
  if (anchorMinutes >= target) return anchor; // the prerequisite finished past the time
  d.setHours(Math.floor(target / 60), target % 60, 0, 0);
  return d.getTime();
}

/**
 * Whether a chat is open at `now`. Gating is opt-in: a thread with no
 * `unlock_after`/`requires` is always open (back-compat). A purchased
 * `skip:<key>` flag bypasses the time wait but still requires the prerequisite.
 */
export function isThreadUnlocked(
  manifest: Manifest,
  day: number,
  threadId: string,
  state: GameState,
  now: number,
): boolean {
  const meta = manifest.threads[threadId];
  if (!meta?.unlock_after && !meta?.requires) return true; // not gated

  const prev = meta.requires ?? previousThread(manifest, day, threadId);
  const prevDone = !prev || state.completed[threadKey(day, prev)] !== undefined;
  if (!prevDone) return false;

  if (state.flags.has(`skip:${threadKey(day, threadId)}`)) return true; // paid skip
  const at = nextUnlockAt(manifest, day, threadId, state, now);
  return at !== null && now >= at;
}

// ─── DAY PROGRESS ────────────────────────────────────────
// The active game's "current day" is *derived* from completions, never stored —
// so it can't desync. A day is complete once all its threads are done; the
// current day is the first incomplete one; the timeline classifies the rest.

/** Every thread on the day has been completed (by its day-scoped key). */
export function isDayComplete(manifest: Manifest, day: number, state: GameState): boolean {
  const threads = listThreads(manifest, day);
  if (threads.length === 0) return false; // a day with no threads is never "done"
  return threads.every((t) => state.completed[threadKey(day, t.id)] !== undefined);
}

/**
 * The day the player is currently on: the first day that isn't complete, or the
 * last day if every day is done. Derived from the `completed` map — no pointer.
 */
export function currentDay(manifest: Manifest, state: GameState): number {
  const days = manifest.days.map((d) => d.day).sort((a, b) => a - b);
  for (const d of days) {
    if (!isDayComplete(manifest, d, state)) return d;
  }
  return days[days.length - 1] ?? 1;
}

export type DayStatus = "past" | "current" | "future";

/** Timeline classification: past (complete, rereadable), current, or future (locked). */
export function dayStatus(manifest: Manifest, day: number, state: GameState): DayStatus {
  const cur = currentDay(manifest, state);
  if (day < cur) return "past";
  if (day === cur) return "current";
  return "future";
}

// ─── BLOCK → SEGMENT ─────────────────────────────────────

/** Convert an authored content block into a runtime segment the engine can play. */
export function convertBlockToSegment(block: Block): SegmentInput {
  const messages: SegmentInput["messages"] = [];
  const choices: Record<
    string,
    { character?: string; options: { text: string; effects?: { axis: string; delta: number }[] }[] }
  > = {};

  let msgIndex = 0;

  for (const item of block.items) {
    switch (item.type) {
      case "cue": {
        messages.push({
          id: `${block.block_id}_cue_${msgIndex++}`,
          character: "",
          kind: "cue",
          channel: item.channel,
          value: item.value,
          condition: item.condition,
        });
        break;
      }

      case "message": {
        if (item.messages) {
          for (const text of item.messages) {
            const id = `${block.block_id}_msg_${msgIndex++}`;
            messages.push({
              id,
              character: item.character,
              text,
              condition: item.condition,
              effects: item.effects,
            });
          }
        }
        break;
      }
      case "sticker": {
        const id = `${block.block_id}_sticker_${msgIndex++}`;
        messages.push({
          id,
          character: item.character,
          text: `__sticker__:${item.file}`,
          condition: item.condition,
          effects: item.effects,
        });
        break;
      }
      case "image": {
        const id = `${block.block_id}_image_${msgIndex++}`;
        messages.push({
          id,
          character: item.character,
          text: `__image__:${item.file}`,
          condition: item.condition,
          effects: item.effects,
        });
        break;
      }
      case "choice": {
        // Attach choice to the last message
        if (messages.length > 0 && item.options) {
          const lastMsgId = messages[messages.length - 1]!.id;
          choices[lastMsgId] = {
            character: "character" in item ? item.character : undefined,
            options: item.options.map((opt) => ({
              text: opt.text,
              effects: opt.effects,
            })),
          };
        }
        break;
      }
      case "pool": {
        if ("variants" in item) {
          const id = `${block.block_id}_pool_${msgIndex++}`;
          messages.push({
            id,
            character: item.character,
            pool: item.variants.map((v, i) => ({
              idx: i,
              text: v.text,
              weight: v.weight ?? 1,
            })),
            condition: item.condition,
            effects: item.effects,
          });
        }
        break;
      }
      case "status": {
        messages.push({
          id: `${block.block_id}_status_${msgIndex++}`,
          character: "",
          text: `__status__:${item.text}`,
          delay_ms: 0,
          typing_ms: 0, // ← no typing indicator (engine skips when <= 0)
          condition: item.condition,
        });
        break;
      }
      // typing items bypass the engine for now
    }
  }

  return {
    id: block.block_id,
    messages,
    choices: Object.keys(choices).length > 0 ? choices : undefined,
  };
}

// ─── ASSEMBLY ────────────────────────────────────────────

/**
 * Load a single day's segments as a map of playable pieces, attaching each
 * segment's manifest gate. Throws on a missing day or a dangling block.
 */
export function buildDay(
  manifest: Manifest,
  content: StoryFile,
  dayNumber: number,
  route?: string,
): LoadedDay {
  const day = manifest.days.find(
    (d) => d.day === dayNumber && (route ? d.route === route : true),
  );
  if (!day) throw new Error(`Manifest has no day ${dayNumber}`);

  const blockById: Record<string, Block> = {};
  for (const b of content) blockById[b.block_id] = b;

  const segmentsById: Record<string, SegmentInput> = {};
  for (const id of day.segments) {
    const block = blockById[id];
    if (!block) throw new Error(`Day ${dayNumber} references missing block "${id}"`);
    const seg = convertBlockToSegment(block);
    seg.condition = manifest.segments[id]?.condition; // attach the gate from the manifest
    segmentsById[id] = seg;
  }

  return { day, segmentsById, meta: manifest.segments };
}

/**
 * Assemble a day's thread into one flat playable segment, skipping any segment
 * whose gate fails against the given state. Day- and thread-scoped.
 */
export function assembleThread(
  manifest: Manifest,
  content: StoryFile,
  day: number,
  threadId: string,
  state: GameState,
): SegmentInput {
  const dayCfg = manifest.days.find((d) => d.day === day);
  const segmentIds = (dayCfg?.segments ?? []).filter(
    (id) =>
      manifest.segments[id]?.thread_id === threadId &&
      isSegmentAvailable(manifest.segments[id], state),
  );

  const blockById: Record<string, Block> = {};
  for (const b of content) blockById[b.block_id] = b;

  const segs = segmentIds
    .map((id) => blockById[id])
    .filter((b): b is Block => Boolean(b))
    .map(convertBlockToSegment);

  return {
    id: `${day}:${threadId}`,
    messages: segs.flatMap((s) => s.messages),
    choices: Object.assign({}, ...segs.map((s) => s.choices ?? {})),
  };
}

/** Return a copy of a segment with all effects/flags removed — for read-only replay. */
export function stripEffects(segment: SegmentInput): SegmentInput {
  return {
    ...segment,
    messages: segment.messages.map(({ effects, set_flag, ...rest }) => rest),
    choices: segment.choices
      ? Object.fromEntries(
          Object.entries(segment.choices).map(([id, c]) => [
            id,
            { ...c, options: c.options.map(({ effects, ...o }) => o) },
          ]),
        )
      : undefined,
  };
}
