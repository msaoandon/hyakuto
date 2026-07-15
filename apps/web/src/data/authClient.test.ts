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
});
