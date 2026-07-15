import { describe, it, expect, beforeEach, vi } from "vitest";
import { useGameStore, saveToState } from "./gameStore";
import { deleteAccount as deleteAccountMock } from "@/data/authClient";
import type { SaveState } from "@hyakuto/engine";
import type { PlayerSaveT } from "@hyakuto/player-save";

// The real authClient.deleteAccount does a network call gated on
// NEXT_PUBLIC_API_URL, which this test env doesn't set — mock just that one
// export so the "signed in" deletion path is testable without flipping env.
vi.mock("@/data/authClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data/authClient")>();
  return { ...actual, deleteAccount: vi.fn() };
});

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

describe("MC customisation", () => {
  it("setMc merges name/pronouns, writes gender through to save.gender, and marks chosen", () => {
    expect(useGameStore.getState().mcChosen).toBe(false);
    useGameStore.getState().setMc({ name: "Yuki", gender: "female" });
    const s = useGameStore.getState();
    expect(s.mc.name).toBe("Yuki");
    expect(s.mc.pronouns).toBe("they"); // untouched field survives the merge
    expect(s.save.gender).toBe("female"); // engine field, not duplicated
    expect(s.mcChosen).toBe(true);
  });

  it("setMc({}) marks the picker answered without changing anything (Begin with defaults)", () => {
    useGameStore.getState().setMc({});
    const s = useGameStore.getState();
    expect(s.mcChosen).toBe(true);
    expect(s.mc).toEqual({ name: "", pronouns: "they" });
    expect(s.save.gender).toBe("unset");
  });

  it("reset clears the identity and re-arms the first-run picker", () => {
    useGameStore.getState().setMc({ name: "Yuki", pronouns: "she", gender: "female" });
    useGameStore.getState().reset();
    const s = useGameStore.getState();
    expect(s.mc).toEqual({ name: "", pronouns: "they" });
    expect(s.mcChosen).toBe(false);
    expect(s.save.gender).toBe("unset"); // fresh save = fresh engine defaults
    expect(s.mcAvatarUrl).toBeNull();
  });
});

describe("auth choice & session", () => {
  beforeEach(() => {
    useGameStore.setState({ session: null, authChoiceMade: false });
  });

  it("continueAsGuest records the choice without minting a session", () => {
    useGameStore.getState().continueAsGuest();
    const s = useGameStore.getState();
    expect(s.authChoiceMade).toBe(true);
    expect(s.session).toBeNull(); // no network call — sync mints lazily, as before
  });

  it("signIn adopts the session and marks the auth choice made", () => {
    useGameStore.getState().signIn({ token: "hyk_abc", account: { provider: "google", displayName: "Yuki", email: "y@example.com" } });
    const s = useGameStore.getState();
    expect(s.authChoiceMade).toBe(true);
    expect(s.session).toEqual({ token: "hyk_abc", account: { provider: "google", displayName: "Yuki", email: "y@example.com" } });
  });

  it("signOut drops the session but leaves authChoiceMade set (no re-prompt)", async () => {
    useGameStore.getState().signIn({ token: "hyk_abc", account: { provider: "google", displayName: "Yuki", email: null } });
    await useGameStore.getState().signOut();
    const s = useGameStore.getState();
    expect(s.session).toBeNull();
    expect(s.authChoiceMade).toBe(true); // signing out ≠ un-choosing; play continues as guest
  });
});

describe("restoreFromServer", () => {
  const payload: PlayerSaveT = {
    schemaVersion: 1,
    save: {
      axes: { tatsumi: 3 },
      counters: { candles: 77 },
      flags: ["met_ren"],
      poolSelections: {},
      gender: "female",
      choices: {},
    },
    mc: { name: "Юкі", pronouns: "she" },
    mcChosen: true,
    completed: { "1:demo_d1_t1": 1760000000000 },
    dmRead: { demo_dm1: ["demo_dm1_1"] },
  };
  const session = { token: "hyk_restored", account: { provider: "google", displayName: "Yuki", email: null } };

  it("fully replaces local state from a server save and marks the session established", () => {
    // The device had nothing local before this — restoreFromServer is only
    // ever called on that safe path (see /auth/return's wasFresh check).
    useGameStore.getState().restoreFromServer(session, payload);
    const s = useGameStore.getState();
    expect(s.save).toEqual(payload.save);
    expect(s.mc).toEqual(payload.mc);
    expect(s.mcChosen).toBe(true);
    expect(s.completed).toEqual(payload.completed);
    expect(s.dmRead).toEqual(payload.dmRead);
    expect(s.session).toEqual(session);
    expect(s.authChoiceMade).toBe(true);
  });
});

describe("deleteAccount", () => {
  beforeEach(() => {
    useGameStore.setState({ session: null, authChoiceMade: false });
    vi.mocked(deleteAccountMock).mockReset();
  });

  it("wipes local state without a server call when there's no session (nothing to delete)", async () => {
    useGameStore.getState().setMc({ name: "Yuki" });
    useGameStore.getState().completeThread("1:a", makeSave());

    await useGameStore.getState().deleteAccount();

    const s = useGameStore.getState();
    expect(deleteAccountMock).not.toHaveBeenCalled();
    expect(s.mc).toEqual({ name: "", pronouns: "they" });
    expect(s.mcChosen).toBe(false);
    expect(s.completed).toEqual({});
    expect(s.authChoiceMade).toBe(false); // un-armed, not just cleared — a fresh device, not a re-prompt
  });

  it("deletes server-side first, then wipes local state and the session, when signed in", async () => {
    vi.mocked(deleteAccountMock).mockResolvedValue(undefined);
    useGameStore.getState().signIn({ token: "hyk_abc", account: { provider: "google", displayName: "Yuki", email: null } });
    useGameStore.getState().completeThread("1:a", makeSave());

    await useGameStore.getState().deleteAccount();

    expect(deleteAccountMock).toHaveBeenCalledWith("hyk_abc");
    const s = useGameStore.getState();
    expect(s.completed).toEqual({});
    expect(s.session).toBeNull();
    expect(s.authChoiceMade).toBe(false);
  });

  it("leaves local state and the session untouched when the server call fails", async () => {
    vi.mocked(deleteAccountMock).mockRejectedValue(new Error("network down"));
    useGameStore.getState().signIn({ token: "hyk_abc", account: { provider: "google", displayName: "Yuki", email: null } });
    useGameStore.getState().completeThread("1:a", makeSave());

    await expect(useGameStore.getState().deleteAccount()).rejects.toThrow("network down");

    const s = useGameStore.getState();
    expect(Object.keys(s.completed)).toEqual(["1:a"]); // nothing erased on a failed delete
    expect(s.session).toEqual({ token: "hyk_abc", account: { provider: "google", displayName: "Yuki", email: null } });
  });
});
