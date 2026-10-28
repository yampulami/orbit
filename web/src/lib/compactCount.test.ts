import { describe, expect, it } from "vitest";
import { compactCount } from "./compactCount";

describe("compactCount", () => {
  it("leaves small numbers alone", () => {
    expect(compactCount(0)).toBe("0");
    expect(compactCount(284)).toBe("284");
    expect(compactCount(999)).toBe("999");
  });
  it("shortens thousands and millions", () => {
    expect(compactCount(1000)).toBe("1K");
    expect(compactCount(1500)).toBe("1.5K");
    expect(compactCount(15000)).toBe("15K");
    expect(compactCount(2_300_000)).toBe("2.3M");
  });
  it("never goes below zero", () => {
    expect(compactCount(-4)).toBe("0");
  });
});
