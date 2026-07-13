import { describe, it, expect } from "vitest";
import { substituteMC } from "../mc";

describe("substituteMC", () => {
  it("replaces both token forms with the given name, all occurrences", () => {
    expect(substituteMC("{MC} waves. hi {@MC}!", "Yuki")).toBe("Yuki waves. hi Yuki!");
  });

  it("leaves text without tokens untouched", () => {
    expect(substituteMC("no tokens here", "Yuki")).toBe("no tokens here");
  });

  it("works with non-latin names (uk players type Cyrillic)", () => {
    expect(substituteMC("привіт, {MC}", "Юкі")).toBe("привіт, Юкі");
  });
});
