import { describe, it, expect } from "vitest";
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
