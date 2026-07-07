import type { Block, StoryFile } from "../schemas/block";
import type { DayConfig } from "../schemas/day";
import type { SegmentInput } from "../engine";
import type { GameState } from "../state/game-state";
import { evaluateCondition, type RuntimeContext } from "../conditions/parser";
import { resolveLocale, DEFAULT_LOCALE } from "../i18n/localized";

// ─── MANIFEST CONTRACT ───────────────────────────────────
// The manifest shapes the Apps Script exporter emits (see .claude/AppsScript.md)
// are defined as Zod schemas in ../schemas/manifest — the single source of truth,
// validated at the load boundary by parseManifest. Re-exported here so callers
// keep importing manifest types/parse from one place.
export type { SegmentMeta, ThreadMeta, Manifest } from "../schemas/manifest";
export { parseManifest } from "../schemas/manifest";

import type { SegmentMeta, Manifest } from "../schemas/manifest";

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

/** How a playable unit renders: a scrolling chat, a step-through VN reader, or a
 *  cross-day 1:1 DM (rendered like a chat, but surfaced in the Messages inbox). */
export type ThreadKind = "chat" | "vn" | "dm";

/** A playable unit (thread) on a day, with its render kind. */
export type ThreadEntry = { id: string; display_name: string; kind: ThreadKind };

/** Map a segment type to its unit's render kind. */
function kindOf(type: SegmentMeta["type"] | undefined): ThreadKind {
  if (type === "vn") return "vn";
  if (type === "dm") return "dm";
  return "chat";
}

/**
 * The playable units (threads) on a day, in first-appearance order, deduped.
 * `kind` is derived from the unit's segment `type` — structural, not an authored
 * flag. Content validation enforces that a unit's segments are homogeneous in
 * type. DM units appear here too (so the day knows about them), but the day's
 * chat list filters them out — DMs live in the Messages inbox.
 */
export function listThreads(
  manifest: Manifest,
  day: number,
  locale: string = DEFAULT_LOCALE,
): ThreadEntry[] {
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
      display_name: threadDisplayName(manifest, tid, locale),
      kind: kindOf(meta?.type),
    });
  }
  return threads;
}

/** A thread's display name resolved to the active locale, falling back to the
 *  thread id when the thread has no manifest entry. */
export function threadDisplayName(
  manifest: Manifest,
  threadId: string,
  locale: string = DEFAULT_LOCALE,
): string {
  const dn = manifest.threads[threadId]?.display_name;
  return dn === undefined ? threadId : resolveLocale(dn, locale) || threadId;
}

// ─── GATING ──────────────────────────────────────────────

/** A segment plays when it has no gate, or its gate passes against the current state. */
export function isSegmentAvailable(
  meta: SegmentMeta | undefined,
  state: GameState,
  ctx?: RuntimeContext,
): boolean {
  if (!meta?.condition) return true;
  return evaluateCondition(meta.condition, state, ctx);
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

/**
 * Every required thread on the day has been completed (by its day-scoped key).
 * DMs are excluded — they're cross-day, relationship-gated, optional, and tracked
 * under a separate `dm:` key, so they must not gate day progression.
 */
export function isDayComplete(manifest: Manifest, day: number, state: GameState): boolean {
  const threads = listThreads(manifest, day).filter((t) => t.kind !== "dm");
  if (threads.length === 0) return false; // a day with no required threads is never "done"
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

/**
 * Convert an authored content block into a runtime segment the engine can play.
 * This is the localization seam: every translatable field (message/status/choice/
 * pool text) is flattened to `locale` here, so the engine plays plain strings and
 * never sees a locale map. Defaults to the canonical language.
 */
export function convertBlockToSegment(block: Block, locale: string = DEFAULT_LOCALE): SegmentInput {
  const messages: SegmentInput["messages"] = [];
  const choices: NonNullable<SegmentInput["choices"]> = {};

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
          for (const [i, text] of item.messages.entries()) {
            const id = `${block.block_id}_msg_${msgIndex++}`;
            messages.push({
              id,
              character: item.character,
              text: resolveLocale(text, locale),
              condition: item.condition,
              effects: item.effects,
              // The flag fires once the item has fully shown — on the last bubble.
              set_flag: i === item.messages.length - 1 ? item.set_flag : undefined,
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
        // Attach choice to the last message. The authored choice/option ids ride
        // along (they key `state.choices` + the `choice:` predicate), and option
        // conditions too — the engine filters options by them at prompt time.
        if (messages.length > 0 && item.options) {
          const lastMsgId = messages[messages.length - 1]!.id;
          choices[lastMsgId] = {
            id: item.id,
            character: "character" in item ? item.character : undefined,
            options: item.options.map((opt) => ({
              id: opt.id,
              text: resolveLocale(opt.text, locale),
              condition: opt.condition,
              effects: opt.effects,
              set_flag: opt.set_flag,
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
              text: resolveLocale(v.text, locale),
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
          text: `__status__:${resolveLocale(item.text, locale)}`,
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
  locale: string = DEFAULT_LOCALE,
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
    .map((b) => convertBlockToSegment(b, locale));

  return {
    id: `${day}:${threadId}`,
    messages: segs.flatMap((s) => s.messages),
    choices: Object.assign({}, ...segs.map((s) => s.choices ?? {})),
  };
}

// ─── DM (cross-day 1:1) ──────────────────────────────────
// DMs are ongoing one-on-one threads that accumulate across days, gated by
// relationship conditions (segment `condition`), not the day's sequence/time
// rule. They surface in the Messages inbox, never the day chat list.

/** A DM thread for the inbox: its contact, surfaced state, and unlocked segments. */
export type DmEntry = {
  id: string; // thread_id
  display_name: string; // contact name
  contact?: string; // contact character ID (for the avatar)
  /** True once the *first* segment's gate passes — the conversation has started
   *  (the contact has messaged you). Later segments append as they unlock. */
  available: boolean;
  /** The currently-unlocked segment ids, in day order. Diff against the save's
   *  read cursor to compute unread ("new messages"). */
  segments: string[];
};

/** The completion key for a DM. Cross-day, so distinct from the day-scoped key. */
export function dmKey(threadId: string): string {
  return `dm:${threadId}`;
}

/** Every DM segment across the manifest, grouped by thread, in first-appearance order. */
function dmSegmentsByThread(manifest: Manifest): { order: string[]; byThread: Record<string, string[]> } {
  const order: string[] = [];
  const byThread: Record<string, string[]> = {};
  for (const day of manifest.days) {
    for (const id of day.segments) {
      const meta = manifest.segments[id];
      if (meta?.type !== "dm" || !meta.thread_id) continue;
      const tid = meta.thread_id;
      if (!(tid in byThread)) {
        byThread[tid] = [];
        order.push(tid);
      }
      byThread[tid]!.push(id);
    }
  }
  return { order, byThread };
}

/** The unlocked segment ids of a DM thread, in day order. */
export function availableDmSegments(manifest: Manifest, threadId: string, state: GameState): string[] {
  const { byThread } = dmSegmentsByThread(manifest);
  return (byThread[threadId] ?? []).filter((id) => isSegmentAvailable(manifest.segments[id], state));
}

/** All DM threads, with their contact, surfaced state, and unlocked segments. */
export function listDMs(
  manifest: Manifest,
  state: GameState,
  locale: string = DEFAULT_LOCALE,
): DmEntry[] {
  const { order, byThread } = dmSegmentsByThread(manifest);
  return order.map((tid) => ({
    id: tid,
    display_name: threadDisplayName(manifest, tid, locale),
    contact: manifest.threads[tid]?.contact,
    // The first segment in day order is the conversation's opener.
    available: isSegmentAvailable(manifest.segments[byThread[tid]![0]!], state),
    segments: byThread[tid]!.filter((id) => isSegmentAvailable(manifest.segments[id], state)),
  }));
}

/**
 * Assemble a DM thread into one flat segment. By default it includes every
 * currently-unlocked segment; pass `segmentIds` to play a subset (e.g. only the
 * unread "new messages" on re-entry). Ids are intersected with the unlocked set,
 * so a locked segment can never be forced in. The cross-day sibling of
 * assembleThread.
 *
 * Note: choices are interactive and we don't yet record which option was chosen
 * (Phase 3). So an *already-read* segment must NOT be replayed interactively — it
 * would re-prompt. Callers play only unread segments, and use `stripChoices` for
 * a non-interactive read-back of history.
 */
export function assembleDM(
  manifest: Manifest,
  content: StoryFile,
  threadId: string,
  state: GameState,
  segmentIds?: string[],
  locale: string = DEFAULT_LOCALE,
): SegmentInput {
  const available = availableDmSegments(manifest, threadId, state);
  const ids = (segmentIds ?? available).filter((id) => available.includes(id));

  const blockById: Record<string, Block> = {};
  for (const b of content) blockById[b.block_id] = b;

  const segs = ids
    .map((id) => blockById[id])
    .filter((b): b is Block => Boolean(b))
    .map((b) => convertBlockToSegment(b, locale));

  return {
    id: dmKey(threadId),
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
            { ...c, options: c.options.map(({ effects, set_flag, ...o }) => o) },
          ]),
        )
      : undefined,
  };
}

/**
 * Resolve recorded picks into the transcript: for every choice whose pick is in
 * `recorded` (state.choices — persisted in the save), replace the prompt with a
 * plain `MC` message of the chosen option's text, right after the message the
 * choice attaches to. The reply inherits the carrier's condition so it never
 * shows without it. Choices with no recorded pick (legacy sessions, ids absent)
 * are left as-is — the caller decides to re-prompt or strip them.
 * This is what makes a re-read DM a faithful transcript: your replies show,
 * nothing re-prompts.
 */
export function resolveChoices(
  segment: SegmentInput,
  recorded: Record<string, string>,
): SegmentInput {
  if (!segment.choices) return segment;

  const remaining: NonNullable<SegmentInput["choices"]> = {};
  const replyAfter = new Map<string, string>(); // carrier message id → picked option text
  for (const [msgId, choice] of Object.entries(segment.choices)) {
    const pickedId = choice.id ? recorded[choice.id] : undefined;
    const picked = pickedId ? choice.options.find((o) => o.id === pickedId) : undefined;
    if (picked) replyAfter.set(msgId, picked.text);
    else remaining[msgId] = choice;
  }
  if (replyAfter.size === 0) return segment;

  const messages = segment.messages.flatMap((m) =>
    replyAfter.has(m.id)
      ? [m, {
          id: `${m.id}__mc_reply`,
          character: "MC" as const,
          text: replyAfter.get(m.id)!,
          typing_ms: 0, // the player doesn't watch themself type
          condition: m.condition,
        }]
      : [m],
  );

  return {
    ...segment,
    messages,
    choices: Object.keys(remaining).length > 0 ? remaining : undefined,
  };
}

/** Return a copy of a segment with its choices removed — a non-interactive
 *  read-back (the messages stream, but no prompt re-appears). Pairs with
 *  stripEffects for re-reading a DM that's fully caught up. */
export function stripChoices(segment: SegmentInput): SegmentInput {
  return { ...segment, choices: undefined };
}
