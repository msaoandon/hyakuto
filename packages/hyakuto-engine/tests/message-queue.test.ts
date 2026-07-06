import { describe, it, expect } from "vitest";
import { resolveQueue, type RawMessage } from "../src/queue/message-queue";
import { createGameState } from "../src/state/game-state";
import type { GameConfig } from "../src/schemas/game-config";
import type { CharacterConfig } from "../src/schemas/character";

const config: GameConfig = {
  axes: ["story", "mio_closeness"],
  characters: [
    { id: "ao", typing_rate: 1.0 },
    { id: "kou", typing_rate: 0.6 },
    { id: "tatsumi", typing_rate: 1.4 },
  ],
  counters: [{ id: "candles", start: 100, end: 0, direction: "down" }],
};

describe("resolveQueue", () => {
  it("resolves standard messages", () => {
    const messages: RawMessage[] = [
      { id: "msg_001", character: "ao", text: "Welcome." },
      { id: "msg_002", character: "kou", text: "hi!" },
    ];
    const state = createGameState(config);
    const queue = resolveQueue(messages, state, config.characters, 1.0);

    expect(queue).toHaveLength(2);
    expect(queue[0]!.text).toBe("Welcome.");
    expect(queue[1]!.text).toBe("hi!");
  });

  it("carries conditions through unevaluated (gating happens at show time in play)", () => {
    const messages: RawMessage[] = [
      { id: "msg_001", character: "ao", text: "Always shown." },
      { id: "msg_002", character: "ao", text: "Only when story > 4.", condition: "story > 4" },
      { id: "msg_003", character: "ao", text: "Fallback.", condition: "story <= 4" },
    ];
    const state = createGameState(config);
    state.axes.story = 5;
    const queue = resolveQueue(messages, state, config.characters, 1.0);

    // Nothing dropped at load — a same-segment choice/effect may still flip a
    // gate before the line is reached. play() skips false gates at show time.
    expect(queue).toHaveLength(3);
    expect(queue.map((m) => m.condition)).toEqual([undefined, "story > 4", "story <= 4"]);
  });

  it("resolves pool messages", () => {
    const messages: RawMessage[] = [
      {
        id: "msg_pool",
        character: "kou",
        pool: [
          { idx: 0, text: "option a", weight: 1 },
          { idx: 1, text: "option b", weight: 1 },
        ],
      },
    ];
    const state = createGameState(config);
    const queue = resolveQueue(messages, state, config.characters, 1.0);

    expect(queue).toHaveLength(1);
    expect(["option a", "option b"]).toContain(queue[0]!.text);
  });

  it("applies character typing rate", () => {
    const messages: RawMessage[] = [
      { id: "msg_slow", character: "tatsumi", text: "The wind was unusual." },
      { id: "msg_fast", character: "kou", text: "The wind was unusual." },
    ];
    const state = createGameState(config);
    const queue = resolveQueue(messages, state, config.characters, 1.0);

    expect(queue[0]!.typing_ms).toBeGreaterThan(queue[1]!.typing_ms);
  });

  it("uses explicit delay_ms when provided", () => {
    const messages: RawMessage[] = [
      { id: "msg_001", character: "tatsumi", text: "Hello.", delay_ms: 6000 },
    ];
    const state = createGameState(config);
    const queue = resolveQueue(messages, state, config.characters, 1.0);

    expect(queue[0]!.delay_ms).toBe(6000);
  });

  it("scales explicit delay_ms by pace", () => {
    const messages: RawMessage[] = [
      { id: "msg_001", character: "tatsumi", text: "Hello.", delay_ms: 6000 },
    ];
    const state = createGameState(config);
    const fast = resolveQueue(messages, state, config.characters, 0.5);

    expect(fast[0]!.delay_ms).toBe(3000);
  });

  it("keeps failing-condition messages queued (play() decides at show time)", () => {
    const messages: RawMessage[] = [
      { id: "msg_001", character: "ao", text: "Nope.", condition: "story > 100" },
    ];
    const state = createGameState(config);
    const queue = resolveQueue(messages, state, config.characters, 1.0);

    expect(queue).toHaveLength(1);
    expect(queue[0]!.condition).toBe("story > 100");
  });

  it("strips all timing at skip pace", () => {
    const messages: RawMessage[] = [
      { id: "msg_001", character: "ao", text: "Hello.", delay_ms: 5000, typing_ms: 2000 },
    ];
    const state = createGameState(config);
    const queue = resolveQueue(messages, state, config.characters, 0);

    expect(queue[0]!.delay_ms).toBe(0);
    expect(queue[0]!.typing_ms).toBe(0);
  });

  it("shorter delay for consecutive messages from same character", () => {
    const messages: RawMessage[] = [
      { id: "msg_001", character: "kou", text: "First." },
      { id: "msg_002", character: "kou", text: "Second." },
      { id: "msg_003", character: "ao", text: "Different character." },
    ];
    const state = createGameState(config);
    const queue = resolveQueue(messages, state, config.characters, 1.0);

    expect(queue[1]!.delay_ms).toBeLessThan(queue[0]!.delay_ms);
    expect(queue[2]!.delay_ms).toBeGreaterThan(queue[1]!.delay_ms);
  });

  it("throws on message with neither text nor pool", () => {
    const messages: RawMessage[] = [{ id: "msg_bad", character: "ao" } as RawMessage];
    const state = createGameState(config);
    expect(() => resolveQueue(messages, state, config.characters, 1.0)).toThrow(
      "neither text nor pool",
    );
  });
});
