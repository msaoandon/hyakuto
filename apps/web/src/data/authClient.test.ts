import { describe, it, expect, afterEach, vi } from "vitest";

// authClient reads NEXT_PUBLIC_API_URL at module load (apiBase.ts) — each test
// that needs a specific value re-imports the module fresh via resetModules.
describe("fetchServerSlot", () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = ORIGINAL;
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("throws when sync is disabled — never a silent no-op on a call that drives live hydration", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    vi.resetModules();
    const { fetchServerSlot } = await import("./authClient");
    await expect(fetchServerSlot("hyk_x")).rejects.toThrow(/sync disabled/);
  });

  it("sends the bearer token and validates the response against the save contract", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3100";
    vi.resetModules();
    const payload = {
      schemaVersion: 1,
      save: { axes: {}, counters: { candles: 100 }, flags: [], poolSelections: {}, gender: "unset", choices: {} },
      mc: { name: "", pronouns: "they" },
      mcChosen: false,
      completed: {},
      dmRead: {},
    };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("http://localhost:3100/v1/me/slots/0");
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer hyk_x");
      return new Response(JSON.stringify(payload), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { fetchServerSlot } = await import("./authClient");
    const result = await fetchServerSlot("hyk_x");
    expect(result).toEqual(payload);
  });

  it("rejects a malformed server response instead of hydrating junk", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3100";
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ nope: true }), { status: 200 })));

    const { fetchServerSlot } = await import("./authClient");
    await expect(fetchServerSlot("hyk_x")).rejects.toThrow();
  });

  it("throws on a non-OK response", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3100";
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));

    const { fetchServerSlot } = await import("./authClient");
    await expect(fetchServerSlot("hyk_x")).rejects.toThrow(/404/);
  });

  it("addresses the requested slot, not always 0 (Saved Games switching)", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3100";
    vi.resetModules();
    const payload = {
      schemaVersion: 1,
      save: { axes: {}, counters: { candles: 5 }, flags: [], poolSelections: {}, gender: "unset", choices: {} },
      mc: { name: "", pronouns: "they" },
      mcChosen: false,
      completed: {},
      dmRead: {},
    };
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe("http://localhost:3100/v1/me/slots/2");
      return new Response(JSON.stringify(payload), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { fetchServerSlot } = await import("./authClient");
    await fetchServerSlot("hyk_x", 2);
  });
});

describe("listSlots", () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = ORIGINAL;
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("throws when sync is disabled", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    vi.resetModules();
    const { listSlots } = await import("./authClient");
    await expect(listSlots("hyk_x")).rejects.toThrow(/sync disabled/);
  });

  it("sends the bearer token to GET /v1/me/slots and returns the metadata list", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3100";
    vi.resetModules();
    const list = [{ slot: 0, updatedAt: "2026-01-01T00:00:00.000Z", candles: 93, completedThreads: 3 }];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("http://localhost:3100/v1/me/slots");
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer hyk_x");
      return new Response(JSON.stringify(list), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { listSlots } = await import("./authClient");
    await expect(listSlots("hyk_x")).resolves.toEqual(list);
  });

  it("throws on a non-OK response", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3100";
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));

    const { listSlots } = await import("./authClient");
    await expect(listSlots("hyk_x")).rejects.toThrow(/401/);
  });
});

describe("deleteSlot", () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = ORIGINAL;
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("throws when sync is disabled — never a silent no-op on a destructive call", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    vi.resetModules();
    const { deleteSlot } = await import("./authClient");
    await expect(deleteSlot("hyk_x", 1)).rejects.toThrow(/sync disabled/);
  });

  it("sends the bearer token to DELETE /v1/me/slots/:slot", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3100";
    vi.resetModules();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("http://localhost:3100/v1/me/slots/1");
      expect(init?.method).toBe("DELETE");
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer hyk_x");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { deleteSlot } = await import("./authClient");
    await expect(deleteSlot("hyk_x", 1)).resolves.toBeUndefined();
  });

  it("throws on a non-OK response — the caller must not drop the slot from the list on a failed delete", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3100";
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));

    const { deleteSlot } = await import("./authClient");
    await expect(deleteSlot("hyk_x", 1)).rejects.toThrow(/404/);
  });
});

describe("deleteAccount", () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = ORIGINAL;
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("throws when sync is disabled — never a silent no-op on a destructive call", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    vi.resetModules();
    const { deleteAccount } = await import("./authClient");
    await expect(deleteAccount("hyk_x")).rejects.toThrow(/sync disabled/);
  });

  it("sends the bearer token to DELETE /v1/me", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3100";
    vi.resetModules();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("http://localhost:3100/v1/me");
      expect(init?.method).toBe("DELETE");
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer hyk_x");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { deleteAccount } = await import("./authClient");
    await expect(deleteAccount("hyk_x")).resolves.toBeUndefined();
  });

  it("throws on a non-OK response — the caller must not wipe local state on a failed delete", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3100";
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));

    const { deleteAccount } = await import("./authClient");
    await expect(deleteAccount("hyk_x")).rejects.toThrow(/401/);
  });
});
