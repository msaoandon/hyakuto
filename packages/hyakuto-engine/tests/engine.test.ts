import { describe, it, expect, vi } from "vitest";
import { createEngine, type EngineEvent, type SegmentInput } from "../src/engine";
import type { GameConfig } from "../src/schemas/game-config";

const config: GameConfig = {
  axes: ["story", "trust"],
  characters: [
    { id: "ao", typing_rate: 1.0 },
    { id: "kou", typing_rate: 0.6 },
  ],
  counters: [{ id: "candles", start: 100, end: 0, direction: "down" }],
};

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
