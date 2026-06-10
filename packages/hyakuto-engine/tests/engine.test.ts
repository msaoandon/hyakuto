import { describe, it, expect, vi } from "vitest";
import { createEngine, type EngineEvent, type SegmentInput } from "../src/engine";
import type { DayConfig } from "../src/schemas/day";
import type { GameConfig } from "../src/schemas/game-config";

const config: GameConfig = {
  axes: ["story", "trust", "sanity"],
  characters: [
    { id: "ao", typing_rate: 1.0 },
    { id: "kou", typing_rate: 0.6 },
  ],
  counters: [{ id: "candles", start: 100, end: 0, direction: "down" }],
};

const shownTexts = (events: EngineEvent[]) =>
  events.flatMap((e) => (e.type === "message_shown" ? [e.message.text] : []));

const simpleSegment: SegmentInput = {
  id: "seg_test",
  messages: [
    { id: "msg_001", character: "ao", text: "Welcome." },
    { id: "msg_002", character: "kou", text: "hi!" },
  ],
};

describe("createEngine", () => {
  it("initializes with fresh state", () => {
    const engine = createEngine({ config, onEvent: () => {} });
    const state = engine.getState();
    expect(state.axes.story).toBe(0);
    expect(state.counters.candles).toBe(100);
  });

  it("restores from saved state", () => {
    const engine = createEngine({
      config,
      onEvent: () => {},
      savedState: {
        axes: { story: 5, trust: 3 },
        counters: { candles: 72 },
        flags: ["some_flag"],
        poolSelections: { msg_001: 2 },
      },
    });
    const state = engine.getState();
    expect(state.axes.story).toBe(5);
    expect(state.counters.candles).toBe(72);
    expect(state.flags.has("some_flag")).toBe(true);
    expect(state.poolSelections.msg_001).toBe(2);
  });
});

describe("play", () => {
  it("emits message_shown events in order", async () => {
    const events: EngineEvent[] = [];
    const engine = createEngine({
      config,
      onEvent: (e) => events.push(e),
    });

    engine.setPace(0); // skip all timing
    engine.loadSegment(simpleSegment);
    await engine.play();

    const messages = events.filter((e) => e.type === "message_shown");
    expect(messages).toHaveLength(2);
    expect(messages[0]!.type === "message_shown" && messages[0]!.message.text).toBe("Welcome.");
    expect(messages[1]!.type === "message_shown" && messages[1]!.message.text).toBe("hi!");
  });

  it("emits segment_complete when done", async () => {
    const events: EngineEvent[] = [];
    const engine = createEngine({
      config,
      onEvent: (e) => events.push(e),
    });

    engine.setPace(0);
    engine.loadSegment(simpleSegment);
    await engine.play();

    const complete = events.find((e) => e.type === "segment_complete");
    expect(complete).toBeDefined();
    if (complete?.type === "segment_complete") {
      expect(complete.segmentId).toBe("seg_test");
    }
  });

  it("applies message effects", async () => {
    const segment: SegmentInput = {
      id: "seg_effects",
      messages: [
        { id: "msg_001", character: "ao", text: "Hello.", effects: [{ axis: "story", delta: 2 }] },
      ],
    };

    const events: EngineEvent[] = [];
    const engine = createEngine({
      config,
      onEvent: (e) => events.push(e),
    });

    engine.setPace(0);
    engine.loadSegment(segment);
    await engine.play();

    expect(engine.getState().axes.story).toBe(2);
    const affinityEvent = events.find((e) => e.type === "affinity_changed");
    expect(affinityEvent).toBeDefined();
  });

  it("sets flags from messages", async () => {
    const segment: SegmentInput = {
      id: "seg_flag",
      messages: [{ id: "msg_001", character: "ao", text: "Unlocked.", set_flag: "path_open" }],
    };

    const engine = createEngine({
      config,
      flagsManifest: ["path_open"],
      onEvent: () => {},
    });

    engine.setPace(0);
    engine.loadSegment(segment);
    await engine.play();

    expect(engine.getState().flags.has("path_open")).toBe(true);
  });

  it("skips messages that fail conditions", async () => {
    const segment: SegmentInput = {
      id: "seg_cond",
      messages: [
        { id: "msg_001", character: "ao", text: "Always." },
        { id: "msg_002", character: "ao", text: "High story only.", condition: "story > 10" },
      ],
    };

    const events: EngineEvent[] = [];
    const engine = createEngine({
      config,
      onEvent: (e) => events.push(e),
    });

    engine.setPace(0);
    engine.loadSegment(segment);
    await engine.play();

    const messages = events.filter((e) => e.type === "message_shown");
    expect(messages).toHaveLength(1);
  });

  it("throws if no segment loaded", async () => {
    const engine = createEngine({ config, onEvent: () => {} });
    await expect(engine.play()).rejects.toThrow("No segment loaded");
  });
});

describe("choices", () => {
  it("pauses for choice and resumes", async () => {
    const segment: SegmentInput = {
      id: "seg_choice",
      messages: [
        { id: "msg_001", character: "ao", text: "What do you think?" },
        { id: "msg_002", character: "ao", text: "Interesting choice." },
      ],
      choices: {
        msg_001: {
          options: [
            { text: "Option A", effects: [{ axis: "story", delta: 1 }] },
            { text: "Option B" },
          ],
        },
      },
    };

    const events: EngineEvent[] = [];
    const engine = createEngine({
      config,
      onEvent: (e) => {
        events.push(e);
        // Auto-choose option 0 when choice is required
        if (e.type === "choice_required") {
          setTimeout(() => engine.chooseOption(0), 0);
        }
      },
    });

    engine.setPace(0);
    engine.loadSegment(segment);
    await engine.play();

    const choiceEvent = events.find((e) => e.type === "choice_required");
    expect(choiceEvent).toBeDefined();

    // Both messages shown
    const messages = events.filter((e) => e.type === "message_shown");
    expect(messages).toHaveLength(2);

    // Choice effect applied
    expect(engine.getState().axes.story).toBe(1);
  });

  it("throws if chooseOption called with no pending choice", () => {
    const engine = createEngine({ config, onEvent: () => {} });
    expect(() => engine.chooseOption(0)).toThrow("No choice is pending");
  });

  it("filters choice options by condition", async () => {
    const segment: SegmentInput = {
      id: "seg_cond_choice",
      messages: [{ id: "msg_001", character: "ao", text: "Choose." }],
      choices: {
        msg_001: {
          options: [
            { text: "Always available" },
            { text: "Only at high story", condition: "story > 10" },
            { text: "Also always available" },
          ],
        },
      },
    };

    const events: EngineEvent[] = [];
    const engine = createEngine({
      config,
      onEvent: (e) => {
        events.push(e);
        if (e.type === "choice_required") {
          setTimeout(() => engine.chooseOption(0), 0);
        }
      },
    });

    engine.setPace(0);
    engine.loadSegment(segment);
    await engine.play();

    const choiceEvent = events.find((e) => e.type === "choice_required");
    expect(choiceEvent).toBeDefined();
    if (choiceEvent?.type === "choice_required") {
      expect(choiceEvent.options).toHaveLength(2);
      expect(choiceEvent.options[0]!.text).toBe("Always available");
      expect(choiceEvent.options[1]!.text).toBe("Also always available");
    }
  });
  it("passes choice character in event", async () => {
    const segment: SegmentInput = {
      id: "seg_dev_choice",
      messages: [{ id: "msg_001", character: "ao", text: "What now?" }],
      choices: {
        msg_001: {
          character: "dev",
          options: [{ text: "Run test" }, { text: "Skip" }],
        },
      },
    };

    const events: EngineEvent[] = [];
    const engine = createEngine({
      config,
      onEvent: (e) => {
        events.push(e);
        if (e.type === "choice_required") {
          setTimeout(() => engine.chooseOption(0), 0);
        }
      },
    });

    engine.setPace(0);
    engine.loadSegment(segment);
    await engine.play();

    const choiceEvent = events.find((e) => e.type === "choice_required");
    expect(choiceEvent).toBeDefined();
    if (choiceEvent?.type === "choice_required") {
      expect(choiceEvent.character).toBe("dev");
    }
  });

  it("omits character for MC choices", async () => {
    const segment: SegmentInput = {
      id: "seg_mc_choice",
      messages: [{ id: "msg_001", character: "ao", text: "Choose." }],
      choices: {
        msg_001: {
          options: [{ text: "Option A" }],
        },
      },
    };

    const events: EngineEvent[] = [];
    const engine = createEngine({
      config,
      onEvent: (e) => {
        events.push(e);
        if (e.type === "choice_required") {
          setTimeout(() => engine.chooseOption(0), 0);
        }
      },
    });

    engine.setPace(0);
    engine.loadSegment(segment);
    await engine.play();

    const choiceEvent = events.find((e) => e.type === "choice_required");
    if (choiceEvent?.type === "choice_required") {
      expect(choiceEvent.character).toBeUndefined();
    }
  });
});

describe("serialize", () => {
  it("round-trips state through serialize/restore", async () => {
    const segment: SegmentInput = {
      id: "seg_test",
      messages: [
        { id: "msg_001", character: "ao", text: "Hello.", effects: [{ axis: "story", delta: 3 }] },
      ],
    };

    const engine1 = createEngine({ config, onEvent: () => {} });
    engine1.setPace(0);
    engine1.loadSegment(segment);
    await engine1.play();

    const saved = engine1.serialize();

    // Restore into new engine
    const engine2 = createEngine({ config, onEvent: () => {}, savedState: saved });
    expect(engine2.getState().axes.story).toBe(3);
  });

  it("serializes flags as array", () => {
    const engine = createEngine({ config, onEvent: () => {} });
    engine.getState().flags.add("test_flag");

    const saved = engine.serialize();
    expect(saved.flags).toContain("test_flag");
    expect(Array.isArray(saved.flags)).toBe(true);
  });
});

describe("pace", () => {
  it("defaults to normal pace", () => {
    const engine = createEngine({ config, onEvent: () => {} });
    expect(engine.getPace()).toBe(1.0);
  });

  it("changes pace", () => {
    const engine = createEngine({ config, onEvent: () => {} });
    engine.setPace(0.5);
    expect(engine.getPace()).toBe(0.5);
  });
});

describe('cues', () => {
  it('emits a cue event with channel and value', async () => {
    const segment: SegmentInput = {
      id: 'seg_cue',
      messages: [
        { id: 'cue_001', character: '', kind: 'cue', channel: 'music', value: 'ambient_01' },
      ],
    };

    const events: EngineEvent[] = [];
    const engine = createEngine({ config, onEvent: (e) => events.push(e) });
    engine.setPace(0);
    engine.loadSegment(segment);
    await engine.play();

    const cue = events.find(e => e.type === 'cue');
    expect(cue).toBeDefined();
    if (cue?.type === 'cue') {
      expect(cue.channel).toBe('music');
      expect(cue.value).toBe('ambient_01');
    }
  });

  it('fires cues in order with messages', async () => {
    const segment: SegmentInput = {
      id: 'seg_order',
      messages: [
        { id: 'msg_001', character: 'ao', text: 'before' },
        { id: 'cue_001', character: '', kind: 'cue', channel: 'glitch', value: 'on' },
        { id: 'msg_002', character: 'ao', text: 'after' },
      ],
    };

    const order: string[] = [];
    const engine = createEngine({
      config,
      onEvent: (e) => {
        if (e.type === 'message_shown') order.push(`msg:${e.message.text}`);
        if (e.type === 'cue') order.push(`cue:${e.value}`);
      },
    });
    engine.setPace(0);
    engine.loadSegment(segment);
    await engine.play();

    expect(order).toEqual(['msg:before', 'cue:on', 'msg:after']);
  });

  it('skips a cue whose condition fails', async () => {
    const segment: SegmentInput = {
      id: 'seg_cond',
      messages: [
        { id: 'cue_001', character: '', kind: 'cue', channel: 'glitch', value: 'on', condition: 'sanity > 5' },
      ],
    };

    const events: EngineEvent[] = [];
    const engine = createEngine({ config, onEvent: (e) => events.push(e) });
    engine.setPace(0);
    engine.loadSegment(segment);
    await engine.play();

    expect(events.find(e => e.type === 'cue')).toBeUndefined();
  });

  it('fires a cue whose condition passes', async () => {
    const segment: SegmentInput = {
      id: 'seg_cond_pass',
      messages: [
        { id: 'cue_001', character: '', kind: 'cue', channel: 'glitch', value: 'on', condition: 'sanity < 5' },
      ],
    };

    const events: EngineEvent[] = [];
    const engine = createEngine({
      config,
      onEvent: (e) => events.push(e),
      savedState: { axes: { sanity: 2 }, counters: {}, flags: [], poolSelections: {} },
    });
    engine.setPace(0);
    engine.loadSegment(segment);
    await engine.play();

    expect(events.find(e => e.type === 'cue')).toBeDefined();
  });
});

describe("playDay", () => {
  it("plays segments in order and fires day_complete once, last", async () => {
    const segments: Record<string, SegmentInput> = {
      s1: { id: "s1", messages: [{ id: "m1", character: "ao", text: "first" }] },
      s2: { id: "s2", messages: [{ id: "m2", character: "ao", text: "second" }] },
    };
    const day: DayConfig = { day: 1, route: "r", segments: ["s1", "s2"] };

    const events: EngineEvent[] = [];
    const engine = createEngine({ config, onEvent: (e) => events.push(e) });
    engine.setPace(0);
    engine.loadDay(day, segments);
    await engine.playDay();

    expect(shownTexts(events)).toEqual(["first", "second"]);

    const dayDone = events.filter((e) => e.type === "day_complete");
    expect(dayDone).toHaveLength(1);
    expect(events[events.length - 1]!.type).toBe("day_complete"); // it's the final event
    if (dayDone[0]!.type === "day_complete") expect(dayDone[0]!.day).toBe(1);
  });

  it("skips a segment whose condition fails and emits segment_skipped", async () => {
    const segments: Record<string, SegmentInput> = {
      s1: { id: "s1", condition: "story > 10", messages: [{ id: "m1", character: "ao", text: "gated out" }] },
      s2: { id: "s2", messages: [{ id: "m2", character: "ao", text: "plays" }] },
    };
    const day: DayConfig = { day: 1, route: "r", segments: ["s1", "s2"] };

    const events: EngineEvent[] = [];
    const engine = createEngine({ config, onEvent: (e) => events.push(e) });
    engine.setPace(0);
    engine.loadDay(day, segments);
    await engine.playDay();

    const skipped = events.find((e) => e.type === "segment_skipped");
    expect(skipped).toBeDefined();
    if (skipped?.type === "segment_skipped") expect(skipped.segmentId).toBe("s1");

    expect(shownTexts(events)).toEqual(["plays"]); // the gated-out message never shows
  });

  it("evaluates gates lazily: segment 1's flag gates segment 2 in", async () => {
    const segments: Record<string, SegmentInput> = {
      s1: { id: "s1", messages: [{ id: "m1", character: "ao", text: "open it", set_flag: "door_open" }] },
      s2: { id: "s2", condition: "flag:door_open", messages: [{ id: "m2", character: "ao", text: "through" }] },
    };
    const day: DayConfig = { day: 1, route: "r", segments: ["s1", "s2"] };

    const events: EngineEvent[] = [];
    const engine = createEngine({ config, flagsManifest: ["door_open"], onEvent: (e) => events.push(e) });
    engine.setPace(0);
    engine.loadDay(day, segments);
    await engine.playDay();

    expect(shownTexts(events)).toEqual(["open it", "through"]); // s2 ran because s1 set the flag
    expect(events.find((e) => e.type === "segment_skipped")).toBeUndefined();
  });

  it("fires day_complete even when every segment is skipped", async () => {
    const segments: Record<string, SegmentInput> = {
      s1: { id: "s1", condition: "story > 10", messages: [{ id: "m1", character: "ao", text: "no" }] },
      s2: { id: "s2", condition: "story > 20", messages: [{ id: "m2", character: "ao", text: "no" }] },
    };
    const day: DayConfig = { day: 1, route: "r", segments: ["s1", "s2"] };

    const events: EngineEvent[] = [];
    const engine = createEngine({ config, onEvent: (e) => events.push(e) });
    engine.setPace(0);
    engine.loadDay(day, segments);
    await engine.playDay();

    expect(shownTexts(events)).toHaveLength(0);
    expect(events.filter((e) => e.type === "segment_skipped")).toHaveLength(2);
    expect(events.find((e) => e.type === "day_complete")).toBeDefined();
  });

  it("throws when the day references an unknown segment", async () => {
    const segments: Record<string, SegmentInput> = {
      s1: { id: "s1", messages: [{ id: "m1", character: "ao", text: "hi" }] },
    };
    const day: DayConfig = { day: 1, route: "r", segments: ["s1", "missing"] };

    const engine = createEngine({ config, onEvent: () => {} });
    engine.setPace(0);
    engine.loadDay(day, segments);
    await expect(engine.playDay()).rejects.toThrow("unknown segment");
  });

  it("throws if no day loaded", async () => {
    const engine = createEngine({ config, onEvent: () => {} });
    await expect(engine.playDay()).rejects.toThrow("No day loaded");
  });
});
