import { describe, it, expect } from "vitest";
import { MessageDef } from "../src/schemas/message";
import { SegmentDef } from "../src/schemas/segment";
import { GameConfig } from "../src/schemas/game-config";
import { SeasonConfig } from "../src/schemas/season";
import { RouteConfig } from "../src/schemas/route";
import { DayConfig } from "../src/schemas/day";
import { Block } from '../src/schemas/block';

describe("MessageDef", () => {
  it("parses a standard message", () => {
    const result = MessageDef.safeParse({
      id: "msg_001",
      character: "ao",
      text: "Welcome.",
    });
    expect(result.success).toBe(true);
  });

  it("parses a message with effects", () => {
    const result = MessageDef.safeParse({
      id: "msg_002",
      character: "tatsumi",
      text: "The wind was unusual.",
      delay_ms: 6000,
      effects: [{ axis: "story", delta: 1 }],
    });
    expect(result.success).toBe(true);
  });

  it("parses a pool message", () => {
    const result = MessageDef.safeParse({
      id: "msg_003",
      character: "kou",
      pool: [
        { idx: 0, text: "bold of you to assume I sleep", weight: 3 },
        { idx: 1, text: "sleep is a human concept", weight: 2 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a message with neither text nor pool", () => {
    const result = MessageDef.safeParse({
      id: "msg_004",
      character: "ao",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty character", () => {
    const result = MessageDef.safeParse({
      id: "msg_005",
      character: "",
      text: "hello",
    });
    expect(result.success).toBe(false);
  });
});

describe("SegmentDef", () => {
  it("parses a minimal segment", () => {
    const result = SegmentDef.safeParse({
      id: "seg_001",
      type: "group_chat",
      messages: [{ id: "msg_001", character: "ao", text: "Hello." }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid segment type", () => {
    const result = SegmentDef.safeParse({
      id: "seg_001",
      type: "invalid_type",
      messages: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("GameConfig", () => {
  it("parses valid config with axes", () => {
    const result = GameConfig.safeParse({
      axes: ["story", "suspense"],
      characters: [{ id: "ao", typing_rate: 1.0 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty axes", () => {
    const result = GameConfig.safeParse({
      axes: [],
      characters: [{ id: "ao" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("SeasonConfig", () => {
  it("parses valid season", () => {
    const result = SeasonConfig.safeParse({
      id: "main",
      routes: ["ao_route", "tatsumi_route"],
      romanceable: ["ao", "tatsumi"],
    });
    expect(result.success).toBe(true);
  });
});

describe("RouteConfig", () => {
  it("parses route with endings", () => {
    const result = RouteConfig.safeParse({
      id: "tatsumi_route",
      flags_manifest: ["third_path_unlocked"],
      endings: [
        { id: "good", condition: "tatsumi_closeness >= 8" },
        { id: "bad", condition: "tatsumi_closeness < 4" },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("DayConfig", () => {
  it("parses valid day", () => {
    const result = DayConfig.safeParse({
      day: 1,
      route: "tatsumi_route",
      segments: ["seg_morning", "seg_vn", "seg_dm", "seg_evening"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty segments", () => {
    const result = DayConfig.safeParse({
      day: 1,
      route: "tatsumi_route",
      segments: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("Block schema", () => {
  it("parses a block with pool item", () => {
    const result = Block.safeParse({
      block_id: "demo_1",
      items: [
        {
          type: "pool",
          character: "kou",
          variants: [
            { text: "option a", weight: 3 },
            { text: "option b", weight: 2 },
            { text: "option c", weight: 1 },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects pool with empty variants", () => {
    const result = Block.safeParse({
      block_id: "demo_1",
      items: [
        {
          type: "pool",
          character: "kou",
          variants: [],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("defaults pool variant weight to 1", () => {
    const result = Block.safeParse({
      block_id: "demo_1",
      items: [
        {
          type: "pool",
          character: "kou",
          variants: [{ text: "no weight specified" }],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const pool = result.data.items[0];
      if (pool?.type === "pool") {
        expect(pool?.variants[0]?.weight).toBe(1);
      }
    }
  });

  it("parses a full block with mixed item types", () => {
    const result = Block.safeParse({
      block_id: "demo_2",
      items: [
        { type: "status", text: "MC joined." },
        { type: "message", character: "ao", messages: ["Welcome."] },
        {
          type: "pool",
          character: "kou",
          variants: [
            { text: "variant a", weight: 2 },
            { text: "variant b", weight: 1 },
          ],
        },
        { type: "choice", options: [{ text: "Option 1" }] },
        { type: "typing", character: "ao" },
      ],
    });
    expect(result.success).toBe(true);
  });
});
