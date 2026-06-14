import { describe, it, expect } from "vitest";
import {
  convertBlockToSegment,
  assembleThread,
  isSegmentAvailable,
  listDays,
  listThreads,
  type Manifest,
} from "../src/manifest/manifest";
import type { Block, StoryFile } from "../src/schemas/block";
import type { GameState } from "../src/state/game-state";

const emptyState = (): GameState => ({
  axes: {},
  counters: {},
  flags: new Set(),
  poolSelections: {},
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
      { id: "alpha", display_name: "Alpha" },
      { id: "beta", display_name: "Beta" },
    ]);
  });

  it("listThreads falls back to the id when a display name is missing", () => {
    const m = {
      days: [{ day: 1, route: "common", segments: ["x"] }],
      segments: { x: { id: "x", type: "dm", day: 1, thread_id: "lonely" } },
      threads: {},
    } satisfies Manifest;
    expect(listThreads(m, 1)).toEqual([{ id: "lonely", display_name: "lonely" }]);
  });
});
