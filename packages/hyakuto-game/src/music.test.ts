import { describe, it, expect } from "vitest";
import { pickAppMusic } from "./music";

const at = (hour: number) => {
  const d = new Date(2026, 0, 1);
  d.setHours(hour, 0, 0, 0);
  return d;
};

describe("pickAppMusic", () => {
  it("plays the day theme from 06:00 up to (not including) 18:00", () => {
    expect(pickAppMusic(at(6))).toEqual(["app_default"]); // 6am boundary → day
    expect(pickAppMusic(at(12))).toEqual(["app_default"]);
    expect(pickAppMusic(at(17))).toEqual(["app_default"]);
  });

  it("plays the night theme from 18:00 through to before 06:00", () => {
    expect(pickAppMusic(at(18))).toEqual(["app_night"]); // 6pm boundary → night
    expect(pickAppMusic(at(23))).toEqual(["app_night"]);
    expect(pickAppMusic(at(0))).toEqual(["app_night"]);
    expect(pickAppMusic(at(5))).toEqual(["app_night"]);
  });
});
