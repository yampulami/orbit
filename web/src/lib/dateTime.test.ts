import { describe as suite, expect, it } from "vitest";
import { defaultTime, describe, fromValue, monthGrid, toValue, ymdOf } from "./dateTime";

suite("date and time picker helpers", () => {
  it("splits and joins a value", () => {
    expect(fromValue("2026-10-27T16:05")).toEqual({ date: "2026-10-27", time: "16:05" });
    expect(toValue("2026-10-27", "16:05")).toBe("2026-10-27T16:05");
    expect(fromValue("")).toBeNull();
    expect(fromValue("tomorrow")).toBeNull();
  });
  it("describes a value in words, and nothing for an empty one", () => {
    expect(describe("2026-10-27T16:05", "en-US")).toBe("Tue, Oct 27 · 4:05 PM");
    expect(describe("", "en-US")).toBe("");
  });
  it("lays out a month in whole weeks starting on Sunday", () => {
    const weeks = monthGrid(2026, 9); // October 2026 starts on a Thursday
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0][0].date).toBe("2026-09-27");
    expect(weeks[0][4]).toEqual({ date: "2026-10-01", inMonth: true });
    expect(weeks.flat().filter((c) => c.inMonth)).toHaveLength(31);
    expect(weeks).toHaveLength(5);
  });
  it("uses six weeks when the month needs them", () => {
    expect(monthGrid(2026, 7)).toHaveLength(6); // August 2026 starts on a Saturday and has 31 days
  });
  it("starts from the next hour today and 9 AM on another day", () => {
    const now = new Date(2026, 9, 26, 14, 20);
    expect(defaultTime(ymdOf(now), now)).toBe("15:00");
    expect(defaultTime("2026-10-30", now)).toBe("09:00");
    expect(defaultTime(ymdOf(new Date(2026, 9, 26, 23, 30)), new Date(2026, 9, 26, 23, 30))).toBe("23:00");
  });
});
