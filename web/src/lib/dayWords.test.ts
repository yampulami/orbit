import { describe, expect, it } from "vitest";
import { ago, clock, dayWord } from "./dayWords";

const now = new Date(2026, 9, 31, 12, 0); // Sat 31 Oct 2026, noon

describe("dayWord", () => {
  it("says today and tomorrow, then the weekday, then the date", () => {
    expect(dayWord(new Date(2026, 9, 31, 18), now)).toBe("Today");
    expect(dayWord(new Date(2026, 10, 1, 9), now)).toBe("Tomorrow");
    expect(dayWord(new Date(2026, 10, 3, 9), now)).toBe("Tue");
    expect(dayWord(new Date(2026, 10, 20, 9), now)).toMatch(/Nov/);
  });
});

describe("ago", () => {
  it("reads like a person", () => {
    expect(ago(new Date(2026, 9, 31, 11, 59, 40).toISOString(), now)).toBe("just now");
    expect(ago(new Date(2026, 9, 31, 11, 48).toISOString(), now)).toBe("12m ago");
    expect(ago(new Date(2026, 9, 31, 9, 0).toISOString(), now)).toBe("3h ago");
    expect(ago(new Date(2026, 9, 30, 20, 0).toISOString(), now)).toBe("Yesterday");
    expect(ago(new Date(2026, 9, 28, 9, 0).toISOString(), now)).toBe("Wed");
    expect(ago(new Date(2026, 9, 10, 9, 0).toISOString(), now)).toMatch(/Oct/);
  });
});

describe("clock", () => {
  it("is the time with AM or PM", () => {
    expect(clock(new Date(2026, 9, 31, 9, 5))).toMatch(/9:05/);
  });
});
