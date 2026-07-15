import { describe, it, expect, afterEach, vi } from "vitest";
import { buildPlayerSave } from "./saveSync";

describe("buildPlayerSave", () => {
  const storeLike = {
    save: {
      axes: { tatsumi: 1 }, counters: { candles: 97 }, flags: [],
      poolSelections: {}, gender: "unset" as const, choices: {},
    },
    mc: { name: "Юкі", pronouns: "she" as const },
    mcChosen: true,
    completed: { "1:t1": 1760000000000 },
    dmRead: {},
  };

  it("builds a contract-valid payload from a store snapshot", () => {
    const p = buildPlayerSave(storeLike);
    expect(p.schemaVersion).toBe(1);
    expect(p.save.counters.candles).toBe(97);
    expect(p.mc.name).toBe("Юкі");
  });

  it("device prefs can never leak into the payload (contract owns the shape)", () => {
    const p = buildPlayerSave(storeLike);
    expect(Object.keys(p).sort()).toEqual(["completed", "dmRead", "mc", "mcChosen", "save", "schemaVersion"]);
  });

  it("fails loudly on shape drift instead of pushing junk", () => {
    const drifted = { ...storeLike, save: { ...storeLike.save, flags: "oops" } };
    // @ts-expect-error — deliberately malformed
    expect(() => buildPlayerSave(drifted)).toThrow();
  });
});

describe("pushSave / pushSlotDelete slot targeting", () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_API_URL;
  const snapshot = {
    save: { axes: {}, counters: { candles: 50 }, flags: [], poolSelections: {}, gender: "unset" as const, choices: {} },
    mc: { name: "", pronouns: "they" as const },
    mcChosen: false,
    completed: {},
    dmRead: {},
  };

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = ORIGINAL;
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.resetModules();
  });

  it("PUTs to the caller-supplied slot, not always 0", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3100";
    vi.resetModules();
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("http://localhost:3100/v1/me/slots/3");
      expect(init?.method).toBe("PUT");
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { pushSave } = await import("./saveSync");
    pushSave("hyk_x", 3, snapshot);
    await vi.runAllTimersAsync();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("DELETEs the caller-supplied slot, not always 0", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3100";
    vi.resetModules();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("http://localhost:3100/v1/me/slots/3");
      expect(init?.method).toBe("DELETE");
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { pushSlotDelete } = await import("./saveSync");
    pushSlotDelete("hyk_x", 3);
    await Promise.resolve(); // let the fire-and-forget fetch's microtask run
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
