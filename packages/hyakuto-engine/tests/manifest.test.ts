import { describe, it, expect } from "vitest";
import {
  convertBlockToSegment,
  assembleThread,
  isSegmentAvailable,
  listDays,
  listThreads,
  stripEffects,
  previousThread,
  nextUnlockAt,
  isThreadUnlocked,
  threadKey,
  isDayComplete,
  currentDay,
  dayStatus,
  listDMs,
  assembleDM,
  availableDmSegments,
  dmKey,
  threadDisplayName,
  type Manifest,
} from "../src/manifest/manifest";
import { evaluateCondition } from "../src/conditions/parser";
import type { Block, StoryFile } from "../src/schemas/block";
import type { GameState } from "../src/state/game-state";
import type { SegmentInput } from "../src/engine";

const emptyState = (): GameState => ({
  axes: {},
  counters: {},
  flags: new Set(),
  poolSelections: {},
  completed: {},
  gender: "unset",
});

describe("convertBlockToSegment", () => {
  it("encodes a status item as a zero-timing engine message", () => {
    const block: Block = {
      block_id: "s",
      items: [{ type: "status", text: "{MC} joined the room." }],
    };

    const seg = convertBlockToSegment(block);

    expect(seg.messages).toHaveLength(1);
    const m = seg.messages[0]!;
    expect(m.text).toBe("__status__:{MC} joined the room.");
    expect(m.character).toBe("");
    expect(m.delay_ms).toBe(0);
    expect(m.typing_ms).toBe(0);
  });

  it("gives every message a unique, block-prefixed id, preserving order", () => {
    const block: Block = {
      block_id: "blk",
      items: [
        { type: "message", character: "Kou", messages: ["a", "b"] },
        { type: "message", character: "Ren", messages: ["c"] },
      ],
    };

    const seg = convertBlockToSegment(block);
    const ids = seg.messages.map((m) => m.id);

    expect(ids).toEqual(["blk_msg_0", "blk_msg_1", "blk_msg_2"]);
    expect(seg.messages.map((m) => m.text)).toEqual(["a", "b", "c"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("attaches a choice to the message immediately before it", () => {
    const block: Block = {
      block_id: "c",
      items: [
        { type: "message", character: "Kou", messages: ["pick?"] },
        { type: "choice", options: [{ text: "yes" }, { text: "no" }] },
      ],
    };

    const seg = convertBlockToSegment(block);

    expect(Object.keys(seg.choices ?? {})).toEqual(["c_msg_0"]);
    expect(seg.choices!["c_msg_0"]!.options.map((o) => o.text)).toEqual(["yes", "no"]);
  });

  it("converts a cue item into a cue-kind message", () => {
    const block: Block = {
      block_id: "q",
      items: [{ type: "cue", channel: "music", value: "ambient_01" }],
    };

    const seg = convertBlockToSegment(block);

    expect(seg.messages[0]!.kind).toBe("cue");
    expect(seg.messages[0]!.channel).toBe("music");
    expect(seg.messages[0]!.value).toBe("ambient_01");
  });

  it("carries effects on image and sticker items (they play as messages)", () => {
    const block: Block = {
      block_id: "fx",
      items: [
        { type: "image", character: "Tatsumi", file: "kojiki1.jpg", effects: [{ axis: "candles", delta: -1 }] },
        { type: "sticker", character: "Kou", file: "wink.png", effects: [{ axis: "trust", delta: 1 }] },
      ],
    };

    const seg = convertBlockToSegment(block);

    expect(seg.messages[0]!.text).toBe("__image__:kojiki1.jpg");
    expect(seg.messages[0]!.effects).toEqual([{ axis: "candles", delta: -1 }]);
    expect(seg.messages[1]!.text).toBe("__sticker__:wink.png");
    expect(seg.messages[1]!.effects).toEqual([{ axis: "trust", delta: 1 }]);
  });
});

describe("assembleThread", () => {
  // Two threads on day 1 (alpha spans a1+a2, beta is b1) and a same-named
  // thread on day 2 (a3) — so we can prove both day- and thread-scoping.
  const manifest = {
    days: [
      { day: 1, route: "common", segments: ["a1", "a2", "b1"] },
      { day: 2, route: "common", segments: ["a3"] },
    ],
    segments: {
      a1: { id: "a1", type: "group_chat", day: 1, thread_id: "alpha" },
      a2: { id: "a2", type: "group_chat", day: 1, thread_id: "alpha" },
      b1: { id: "b1", type: "group_chat", day: 1, thread_id: "beta" },
      a3: { id: "a3", type: "group_chat", day: 2, thread_id: "alpha" },
    },
    threads: { alpha: { display_name: "Alpha" }, beta: { display_name: "Beta" } },
  } satisfies Manifest;

  const content = [
    { block_id: "a1", items: [{ type: "message", character: "Kou", messages: ["one"] }] },
    { block_id: "a2", items: [{ type: "message", character: "Ren", messages: ["two"] }] },
    { block_id: "b1", items: [{ type: "message", character: "Tatsumi", messages: ["beta"] }] },
    { block_id: "a3", items: [{ type: "message", character: "Kou", messages: ["day2"] }] },
  ] satisfies StoryFile;

  it("concatenates a thread's segments in day order", () => {
    const seg = assembleThread(manifest, content, 1, "alpha", emptyState());
    expect(seg.messages.map((m) => m.text)).toEqual(["one", "two"]);
  });

  it("uses a `day:thread` id", () => {
    expect(assembleThread(manifest, content, 1, "alpha", emptyState()).id).toBe("1:alpha");
  });

  it("includes only segments matching the thread (not sibling threads)", () => {
    const seg = assembleThread(manifest, content, 1, "beta", emptyState());
    expect(seg.messages.map((m) => m.text)).toEqual(["beta"]);
  });

  it("scopes to the day — a same-named thread on another day is excluded", () => {
    const seg = assembleThread(manifest, content, 2, "alpha", emptyState());
    expect(seg.messages.map((m) => m.text)).toEqual(["day2"]);
  });

  it("returns an empty thread when nothing matches", () => {
    const seg = assembleThread(manifest, content, 1, "missing", emptyState());
    expect(seg.messages).toEqual([]);
  });

  it("skips a segment whose condition fails, includes it when it passes", () => {
    const m = {
      days: [{ day: 1, route: "common", segments: ["g1", "g2"] }],
      segments: {
        g1: { id: "g1", type: "group_chat", day: 1, thread_id: "t" },
        g2: { id: "g2", type: "group_chat", day: 1, thread_id: "t", condition: "candles < 60" },
      },
      threads: { t: { display_name: "T" } },
    } satisfies Manifest;
    const c = [
      { block_id: "g1", items: [{ type: "message", character: "Kou", messages: ["always"] }] },
      { block_id: "g2", items: [{ type: "message", character: "Ren", messages: ["secret"] }] },
    ] satisfies StoryFile;

    const locked = { ...emptyState(), counters: { candles: 100 } };
    const unlocked = { ...emptyState(), counters: { candles: 50 } };

    expect(assembleThread(m, c, 1, "t", locked).messages.map((x) => x.text)).toEqual(["always"]);
    expect(assembleThread(m, c, 1, "t", unlocked).messages.map((x) => x.text)).toEqual([
      "always",
      "secret",
    ]);
  });
});

describe("isSegmentAvailable", () => {
  it("is available when there is no condition", () => {
    expect(isSegmentAvailable({ id: "x", type: "dm" }, emptyState())).toBe(true);
    expect(isSegmentAvailable(undefined, emptyState())).toBe(true);
  });

  it("evaluates the condition against state", () => {
    const meta = { id: "x", type: "dm", condition: "candles < 60" } as const;
    expect(isSegmentAvailable(meta, { ...emptyState(), counters: { candles: 50 } })).toBe(true);
    expect(isSegmentAvailable(meta, { ...emptyState(), counters: { candles: 100 } })).toBe(false);
  });
});

describe("navigation", () => {
  const manifest = {
    days: [
      { day: 1, route: "common", segments: ["a1", "a2", "b1"] },
      { day: 2, route: "common", segments: ["c1"] },
    ],
    segments: {
      a1: { id: "a1", type: "group_chat", day: 1, thread_id: "alpha" },
      a2: { id: "a2", type: "group_chat", day: 1, thread_id: "alpha" },
      b1: { id: "b1", type: "group_chat", day: 1, thread_id: "beta" },
      c1: { id: "c1", type: "group_chat", day: 2, thread_id: "gamma" },
    },
    threads: {
      alpha: { display_name: "Alpha" },
      beta: { display_name: "Beta" },
      gamma: { display_name: "Gamma" },
    },
  } satisfies Manifest;

  it("listDays returns the manifest days", () => {
    expect(listDays(manifest).map((d) => d.day)).toEqual([1, 2]);
  });

  it("listThreads dedupes a day's threads in first-appearance order, with names", () => {
    expect(listThreads(manifest, 1)).toEqual([
      { id: "alpha", display_name: "Alpha", kind: "chat" },
      { id: "beta", display_name: "Beta", kind: "chat" },
    ]);
  });

  it("listThreads falls back to the id when a display name is missing", () => {
    const m = {
      days: [{ day: 1, route: "common", segments: ["x"] }],
      segments: { x: { id: "x", type: "dm", day: 1, thread_id: "lonely" } },
      threads: {},
    } satisfies Manifest;
    expect(listThreads(m, 1)).toEqual([{ id: "lonely", display_name: "lonely", kind: "dm" }]);
  });
});

describe("stripEffects", () => {
  it("removes effects/set_flag from messages and effects from choice options", () => {
    const seg: SegmentInput = {
      id: "1:t",
      messages: [
        {
          id: "m0",
          character: "Ren",
          text: "hi",
          effects: [{ axis: "candles", delta: -1 }],
          set_flag: "met_ren",
        },
        { id: "m1", character: "Kou", text: "yo" },
      ],
      choices: {
        m0: {
          options: [{ text: "a", effects: [{ axis: "trust", delta: 1 }] }, { text: "b" }],
        },
      },
    };

    const stripped = stripEffects(seg);

    expect(stripped.messages[0]!.effects).toBeUndefined();
    expect(stripped.messages[0]!.set_flag).toBeUndefined();
    expect(stripped.messages[0]!.text).toBe("hi"); // content preserved
    expect(stripped.choices!.m0!.options[0]!.effects).toBeUndefined();
    expect(stripped.choices!.m0!.options[0]!.text).toBe("a");
    expect(stripped.id).toBe("1:t"); // identity preserved
  });

  it("leaves an effect-free segment unchanged", () => {
    const seg: SegmentInput = {
      id: "1:t",
      messages: [{ id: "m", character: "Kou", text: "hello" }],
    };

    expect(stripEffects(seg).messages).toEqual([{ id: "m", character: "Kou", text: "hello" }]);
  });
});

describe("thread unlock", () => {
  // Day order: alpha (ungated) → beta (requires alpha) → gamma (requires alpha, after 6pm).
  const manifest = {
    days: [{ day: 1, route: "common", segments: ["a1", "b1", "g1"] }],
    segments: {
      a1: { id: "a1", type: "group_chat", day: 1, thread_id: "alpha" },
      b1: { id: "b1", type: "group_chat", day: 1, thread_id: "beta" },
      g1: { id: "g1", type: "group_chat", day: 1, thread_id: "gamma" },
    },
    threads: {
      alpha: { display_name: "Alpha" },
      beta: { display_name: "Beta", requires: "alpha" },
      gamma: { display_name: "Gamma", requires: "alpha", unlock_after: "18:00" },
    },
  } satisfies Manifest;

  const at = (h: number, m = 0) => new Date(2026, 0, 1, h, m, 0).getTime();
  const stateWith = (completed: Record<string, number>, flags: string[] = []): GameState => ({
    ...emptyState(),
    completed,
    flags: new Set(flags),
  });

  it("previousThread follows day order, undefined for the first", () => {
    expect(previousThread(manifest, 1, "alpha")).toBeUndefined();
    expect(previousThread(manifest, 1, "beta")).toBe("alpha");
    expect(previousThread(manifest, 1, "gamma")).toBe("beta");
  });

  it("an ungated thread is always open", () => {
    expect(isThreadUnlocked(manifest, 1, "alpha", emptyState(), at(3))).toBe(true);
  });

  it("a completion-gated thread is locked until its prerequisite is done", () => {
    expect(isThreadUnlocked(manifest, 1, "beta", emptyState(), at(20))).toBe(false);
    const done = stateWith({ [threadKey(1, "alpha")]: at(9) });
    expect(isThreadUnlocked(manifest, 1, "beta", done, at(9))).toBe(true);
  });

  it("returns no unlock time while the prerequisite is incomplete", () => {
    expect(nextUnlockAt(manifest, 1, "gamma", emptyState(), at(20))).toBeNull();
    expect(isThreadUnlocked(manifest, 1, "gamma", emptyState(), at(20))).toBe(false);
  });

  it("anchors the time gate to when the prerequisite completed", () => {
    // alpha finished at 2pm → gamma unlocks at 6pm the same day, not before.
    const done = stateWith({ [threadKey(1, "alpha")]: at(14) });
    expect(nextUnlockAt(manifest, 1, "gamma", done, at(14))).toBe(at(18));
    expect(isThreadUnlocked(manifest, 1, "gamma", done, at(14))).toBe(false);
    expect(isThreadUnlocked(manifest, 1, "gamma", done, at(18, 30))).toBe(true);
  });

  it("unlocks immediately when the prerequisite finished past the gate time", () => {
    // alpha finished at 8pm — already past 6pm → no wait.
    const done = stateWith({ [threadKey(1, "alpha")]: at(20) });
    expect(nextUnlockAt(manifest, 1, "gamma", done, at(20))).toBe(at(20));
    expect(isThreadUnlocked(manifest, 1, "gamma", done, at(20))).toBe(true);
  });

  it("a purchased skip bypasses the time wait but not the prerequisite", () => {
    const skip = `skip:${threadKey(1, "gamma")}`;
    // Skip without the prerequisite done → still locked.
    expect(isThreadUnlocked(manifest, 1, "gamma", stateWith({}, [skip]), at(14))).toBe(false);
    // Prerequisite done + skip → open before 6pm.
    const done = stateWith({ [threadKey(1, "alpha")]: at(14) }, [skip]);
    expect(isThreadUnlocked(manifest, 1, "gamma", done, at(14))).toBe(true);
  });

  it("evaluates a completed:<key> condition against the completed map", () => {
    const done = stateWith({ [threadKey(1, "alpha")]: at(9) });
    expect(evaluateCondition("completed:1:alpha", done)).toBe(true);
    expect(evaluateCondition("completed:1:beta", done)).toBe(false);
  });
});

describe("day progress (derived current day)", () => {
  const m: Manifest = {
    days: [
      { day: 1, route: "common", segments: ["a"] },
      { day: 2, route: "common", segments: ["b"] },
      { day: 3, route: "common", segments: ["c"] },
    ],
    segments: {
      a: { id: "a", type: "group_chat", day: 1, thread_id: "t1" },
      b: { id: "b", type: "group_chat", day: 2, thread_id: "t2" },
      c: { id: "c", type: "group_chat", day: 3, thread_id: "t3" },
    },
    threads: { t1: { display_name: "T1" }, t2: { display_name: "T2" }, t3: { display_name: "T3" } },
  };
  const withDone = (...keys: string[]): GameState => ({
    ...emptyState(),
    completed: Object.fromEntries(keys.map((k) => [k, 0])),
  });

  it("isDayComplete is true only when every required thread on the day is done", () => {
    expect(isDayComplete(m, 1, emptyState())).toBe(false);
    expect(isDayComplete(m, 1, withDone(threadKey(1, "t1")))).toBe(true);
  });

  it("a DM on the day does NOT block day completion (DMs are optional, cross-day)", () => {
    const withDm: Manifest = {
      days: [{ day: 1, route: "common", segments: ["a", "d"] }],
      segments: {
        a: { id: "a", type: "group_chat", day: 1, thread_id: "t1" },
        d: { id: "d", type: "dm", day: 1, thread_id: "dm_ren" },
      },
      threads: { t1: { display_name: "T1" }, dm_ren: { display_name: "Ren" } },
    };
    // The chat is done; the DM is never completed under a day key — day still completes.
    expect(isDayComplete(withDm, 1, withDone(threadKey(1, "t1")))).toBe(true);
  });

  it("currentDay is the first incomplete day", () => {
    expect(currentDay(m, emptyState())).toBe(1);
    expect(currentDay(m, withDone(threadKey(1, "t1")))).toBe(2);
  });

  it("currentDay clamps to the last day when all are complete", () => {
    const all = withDone(threadKey(1, "t1"), threadKey(2, "t2"), threadKey(3, "t3"));
    expect(currentDay(m, all)).toBe(3);
  });

  it("dayStatus classifies past / current / future around the current day", () => {
    const s = withDone(threadKey(1, "t1")); // current = 2
    expect(dayStatus(m, 1, s)).toBe("past");
    expect(dayStatus(m, 2, s)).toBe("current");
    expect(dayStatus(m, 3, s)).toBe("future");
  });
});

describe("DM threads (cross-day, relationship-gated)", () => {
  // dm_ren opens on day 1 (gated on chat1) and continues on day 2 (gated on
  // chat2, later) — so the day-2 line arrives as a "new message".
  const m: Manifest = {
    days: [
      { day: 1, route: "common", segments: ["c1", "d1"] },
      { day: 2, route: "common", segments: ["c2", "d2"] },
    ],
    segments: {
      c1: { id: "c1", type: "group_chat", day: 1, thread_id: "chat1" },
      d1: { id: "d1", type: "dm", day: 1, thread_id: "dm_ren", condition: "completed:1:chat1" },
      c2: { id: "c2", type: "group_chat", day: 2, thread_id: "chat2" },
      d2: { id: "d2", type: "dm", day: 2, thread_id: "dm_ren", condition: "completed:2:chat2" },
    },
    threads: {
      chat1: { display_name: "C1" },
      chat2: { display_name: "C2" },
      dm_ren: { display_name: "Ren", contact: "Ren" },
    },
  };
  const content = [
    { block_id: "c1", items: [{ type: "message", character: "Kou", messages: ["hi"] }] },
    {
      block_id: "d1",
      items: [{ type: "message", character: "Ren", messages: ["day1 dm"], effects: [{ axis: "trust", delta: 1 }] }],
    },
    { block_id: "d2", items: [{ type: "message", character: "Ren", messages: ["day2 dm"] }] },
  ] satisfies StoryFile;
  const done = (...keys: string[]): GameState => ({
    ...emptyState(),
    completed: Object.fromEntries(keys.map((k) => [k, 0])),
  });
  const opened = threadKey(1, "chat1");
  const progressed = threadKey(2, "chat2");

  it("listThreads tags a dm segment's unit with kind 'dm'", () => {
    expect(listThreads(m, 1).find((t) => t.id === "dm_ren")?.kind).toBe("dm");
  });

  it("listDMs: availability + the growing set of unlocked segments", () => {
    expect(listDMs(m, emptyState())).toEqual([
      { id: "dm_ren", display_name: "Ren", contact: "Ren", available: false, segments: [] },
    ]);
    expect(listDMs(m, done(opened))[0]).toMatchObject({ available: true, segments: ["d1"] });
    expect(listDMs(m, done(opened, progressed))[0]!.segments).toEqual(["d1", "d2"]);
  });

  it("availableDmSegments grows as later gates pass", () => {
    expect(availableDmSegments(m, "dm_ren", emptyState())).toEqual([]);
    expect(availableDmSegments(m, "dm_ren", done(opened))).toEqual(["d1"]);
    expect(availableDmSegments(m, "dm_ren", done(opened, progressed))).toEqual(["d1", "d2"]);
  });

  it("assembleDM defaults to all unlocked segments, with a dm: id", () => {
    const seg = assembleDM(m, content, "dm_ren", done(opened, progressed));
    expect(seg.messages.map((x) => x.text)).toEqual(["day1 dm", "day2 dm"]);
    expect(seg.id).toBe(dmKey("dm_ren"));
  });

  it("assembleDM plays only the requested (unread) segments on re-entry", () => {
    const state = done(opened, progressed);
    // Re-open after reading d1 → play only the new d2 (no day-1 replay/re-prompt).
    const seg = assembleDM(m, content, "dm_ren", state, ["d2"]);
    expect(seg.messages.map((x) => x.text)).toEqual(["day2 dm"]);
  });

  it("assembleDM never forces in a locked segment", () => {
    // d2 isn't unlocked yet (only chat1 done) — asking for it yields nothing.
    expect(assembleDM(m, content, "dm_ren", done(opened), ["d2"]).messages).toEqual([]);
  });
});

describe("localization seam", () => {
  // Content authored with locale maps on message, choice, and pool text.
  const block: Block = {
    block_id: "loc_1",
    items: [
      { type: "message", character: "Ren", messages: [{ en: "hey", uk: "агов" }] },
      {
        type: "choice",
        options: [{ text: { en: "Sure", uk: "Звісно" } }, { text: "Neutral" }],
      },
      {
        type: "pool",
        character: "Ren",
        variants: [{ text: { en: "one", uk: "один" }, weight: 1 }],
      },
      { type: "status", text: { en: "Ren left", uk: "Рен вийшов" } },
    ],
  };

  it("convertBlockToSegment resolves message/pool/status/choice text to the locale", () => {
    const uk = convertBlockToSegment(block, "uk");
    expect(uk.messages[0]!.text).toBe("агов");
    expect(uk.messages.find((m) => m.pool)!.pool![0]!.text).toBe("один");
    expect(uk.messages.find((m) => m.text?.startsWith("__status__"))!.text).toBe("__status__:Рен вийшов");
    const choice = Object.values(uk.choices!)[0]!;
    expect(choice.options.map((o) => o.text)).toEqual(["Звісно", "Neutral"]);
  });

  it("defaults to the canonical (en) language", () => {
    const def = convertBlockToSegment(block);
    expect(def.messages[0]!.text).toBe("hey");
  });

  it("a plain-string field is locale-agnostic (back-compat)", () => {
    const choice = Object.values(convertBlockToSegment(block, "uk").choices!)[0]!;
    expect(choice.options[1]!.text).toBe("Neutral"); // no map → same in every locale
  });

  it("threadDisplayName resolves a localized display_name, falling back across locales", () => {
    const m: Manifest = {
      days: [{ day: 1, route: "common", segments: ["a"] }],
      segments: { a: { id: "a", type: "group_chat", day: 1, thread_id: "t1" } },
      threads: { t1: { display_name: { en: "Ren", uk: "Рен" } } },
    };
    expect(threadDisplayName(m, "t1", "uk")).toBe("Рен");
    expect(threadDisplayName(m, "t1", "ja")).toBe("Ren"); // missing → default locale
    expect(threadDisplayName(m, "missing", "uk")).toBe("missing"); // no thread → id
    expect(listThreads(m, 1, "uk")[0]!.display_name).toBe("Рен");
  });
});
