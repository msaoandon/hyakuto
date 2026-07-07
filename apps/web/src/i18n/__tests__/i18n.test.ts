import { describe, it, expect } from "vitest";
import { en } from "../en";
import { uk } from "../uk";
import { interpolate } from "../index";
import { matchDeviceLocale } from "../locales";

describe("i18n dictionaries", () => {
  it("uk has exactly the same keys as en (parity)", () => {
    expect(Object.keys(uk).sort()).toEqual(Object.keys(en).sort());
  });

  it("no UI string is empty in any locale", () => {
    for (const dict of [en, uk]) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value, `empty value for "${key}"`).not.toBe("");
      }
    }
  });
});

describe("interpolate", () => {
  it("substitutes named vars, leaves unknown placeholders intact", () => {
    expect(interpolate("Day {n}", { n: 3 })).toBe("Day 3");
    expect(interpolate("Day {n}")).toBe("Day {n}");
  });
});

describe("matchDeviceLocale (device-language seeding)", () => {
  it("matches a supported base language from region tags, in preference order", () => {
    expect(matchDeviceLocale(["uk-UA", "en-US"])).toBe("uk");
    expect(matchDeviceLocale(["en-GB"])).toBe("en");
    expect(matchDeviceLocale(["ja-JP", "uk"])).toBe("uk"); // first match wins after skips
  });

  it("returns undefined when nothing is supported (caller keeps current locale)", () => {
    expect(matchDeviceLocale(["ja-JP", "de-DE"])).toBeUndefined();
    expect(matchDeviceLocale([])).toBeUndefined();
  });
});
