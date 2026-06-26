import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore, saveToState } from "./gameStore";
import type { SaveState } from "@hyakuto/engine";

const makeSave = (over: Partial<SaveState> = {}): SaveState => ({
  axes: {},
  counters: { candles: 90 },
  flags: [],
  poolSelections: {},
  ...over,
});

beforeEach(() => {
  useGameStore.getState().reset();
});

describe("completeThread", () => {
  it("records the thread with a timestamp and commits the save on first completion", () => {
    useGameStore.getState().completeThread("2:day2_01", makeSave({ counters: { candles: 90 } }));

    const { completed, save } = useGameStore.getState();
    expect(Object.keys(completed)).toEqual(["2:day2_01"]);
    expect(typeof completed["2:day2_01"]).toBe("number"); // completion time recorded
    expect(save.counters.candles).toBe(90);
  });

  it("is idempotent — re-completing changes neither the timestamp nor the save", () => {
    useGameStore.getState().completeThread("2:day2_01", makeSave({ counters: { candles: 90 } }));
    const firstAt = useGameStore.getState().completed["2:day2_01"];
    // a replay would produce a further-dropped save; it must be ignored
    useGameStore.getState().completeThread("2:day2_01", makeSave({ counters: { candles: 80 } }));

    expect(Object.keys(useGameStore.getState().completed)).toEqual(["2:day2_01"]); // no duplicate
    expect(useGameStore.getState().completed["2:day2_01"]).toBe(firstAt); // timestamp frozen
    expect(useGameStore.getState().save.counters.candles).toBe(90); // not re-applied
  });

  it("accumulates distinct threads", () => {
    useGameStore.getState().completeThread("1:a", makeSave());
    useGameStore.getState().completeThread("1:b", makeSave());

    expect(Object.keys(useGameStore.getState().completed)).toEqual(["1:a", "1:b"]);
  });
});

describe("reset", () => {
  it("clears completed and restores a fresh save", () => {
    useGameStore.getState().completeThread("1:x", makeSave({ counters: { candles: 50 } }));
    useGameStore.getState().reset();

    expect(useGameStore.getState().completed).toEqual({});
    expect(useGameStore.getState().save.counters.candles).toBe(100); // fresh-game default
  });
});

describe("saveToState", () => {
  it("converts a SaveState (flags array) into a GameState (flags Set)", () => {
    const state = saveToState(makeSave({ flags: ["a", "b"], axes: { trust: 2 } }));

    expect(state.flags).toBeInstanceOf(Set);
    expect(state.flags.has("a")).toBe(true);
    expect(state.axes.trust).toBe(2);
  });

  it("carries the completed map through for unlock gating", () => {
    const state = saveToState(makeSave(), { "1:a": 1234 });

    expect(state.completed).toEqual({ "1:a": 1234 });
  });
});
