import { describe, expect, it } from "vitest";
import { goingLine, isNight } from "./cheer";

describe("isNight", () => {
  it("is late night only", () => {
    expect(isNight(new Date(2026, 9, 27, 23, 30))).toBe(true);
    expect(isNight(new Date(2026, 9, 27, 2, 0))).toBe(true);
    expect(isNight(new Date(2026, 9, 27, 5, 0))).toBe(false);
    expect(isNight(new Date(2026, 9, 27, 14, 0))).toBe(false);
  });
});

describe("goingLine", () => {
  it("always gives a line, even for odd numbers", () => {
    for (const n of [0, 1, 7, -3, 1000]) expect(goingLine(n).length).toBeGreaterThan(3);
  });
});
