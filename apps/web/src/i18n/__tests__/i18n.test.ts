import { describe, it, expect } from "vitest";
import { en } from "../en";
import { uk } from "../uk";
import { useT } from "../index";

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

describe("useT", () => {
  it("returns the string for a key", () => {
    const t = useT();
    expect(t("play.chooseDay")).toBe("Choose a day");
  });

  it("interpolates named vars and leaves unknown placeholders intact", () => {
    const t = useT();
    expect(t("play.day", { n: 3 })).toBe("Day 3");
    expect(t("play.day")).toBe("Day {n}");
  });
});
