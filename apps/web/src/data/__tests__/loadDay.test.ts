import { describe, it, expect } from "vitest";
import type { Block, StoryFile, GameState } from "@hyakuto/engine";
import { convertBlockToSegment, assembleThread, type Manifest } from "../loadDay";

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
    // zero timing is what keeps the typing indicator off — engine skips when <= 0
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
  const state: GameState = { axes: {}, counters: {}, flags: new Set(), poolSelections: {} };

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
    const seg = assembleThread(1, "alpha", state, manifest, content);
    expect(seg.messages.map((m) => m.text)).toEqual(["one", "two"]);
  });

  it("uses a `day:thread` id", () => {
    expect(assembleThread(1, "alpha", state, manifest, content).id).toBe("1:alpha");
  });

  it("includes only segments matching the thread (not sibling threads)", () => {
    const seg = assembleThread(1, "beta", state, manifest, content);
    expect(seg.messages.map((m) => m.text)).toEqual(["beta"]);
  });

  it("scopes to the day — a same-named thread on another day is excluded", () => {
    // day 2's "alpha" must not pull in day 1's a1/a2
    const seg = assembleThread(2, "alpha", state, manifest, content);
    expect(seg.messages.map((m) => m.text)).toEqual(["day2"]);
  });

  it("merges choices from every segment without collision", () => {
    const withChoices = [
      {
        block_id: "a1",
        items: [
          { type: "message", character: "Kou", messages: ["one"] },
          { type: "choice", options: [{ text: "yes" }] },
        ],
      },
      {
        block_id: "a2",
        items: [
          { type: "message", character: "Ren", messages: ["two"] },
          { type: "choice", options: [{ text: "no" }] },
        ],
      },
    ] satisfies StoryFile;

    const seg = assembleThread(1, "alpha", state, manifest, withChoices);
    expect(Object.keys(seg.choices ?? {}).sort()).toEqual(["a1_msg_0", "a2_msg_0"]);
  });

  it("returns an empty thread when nothing matches", () => {
    const seg = assembleThread(1, "missing", state, manifest, content);
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

    const locked = { ...state, counters: { candles: 100 } }; // 100 < 60 → false
    const unlocked = { ...state, counters: { candles: 50 } }; //  50 < 60 → true

    expect(assembleThread(1, "t", locked, m, c).messages.map((x) => x.text)).toEqual(["always"]);
    expect(assembleThread(1, "t", unlocked, m, c).messages.map((x) => x.text)).toEqual([
      "always",
      "secret",
    ]);
  });
});
