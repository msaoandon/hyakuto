import { describe, it, expect } from "vitest";
import { resolveLocale, localizedValues, DEFAULT_LOCALE } from "../src/i18n/localized";

describe("resolveLocale", () => {
  it("passes a plain string through unchanged", () => {
    expect(resolveLocale("Ren", "uk")).toBe("Ren");
  });

  it("resolves a map to the requested locale", () => {
    expect(resolveLocale({ en: "Ren", uk: "Рен" }, "uk")).toBe("Рен");
    expect(resolveLocale({ en: "Ren", uk: "Рен" }, "en")).toBe("Ren");
  });

  it("falls back to the default locale when the requested one is missing", () => {
    expect(resolveLocale({ en: "Ren" }, "uk")).toBe("Ren");
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it("falls back to any present value when the default is missing too", () => {
    expect(resolveLocale({ uk: "Рен" }, "ja")).toBe("Рен");
  });

  it("returns empty string for an empty map", () => {
    expect(resolveLocale({}, "en")).toBe("");
  });
});

describe("localizedValues", () => {
  it("returns one value for a string", () => {
    expect(localizedValues("hi")).toEqual(["hi"]);
  });
  it("returns every locale's text for a map", () => {
    expect(localizedValues({ en: "hi", uk: "привіт" }).sort()).toEqual(["hi", "привіт"]);
  });
  it("returns nothing for an empty map", () => {
    expect(localizedValues({})).toEqual([]);
  });
});
