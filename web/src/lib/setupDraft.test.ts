import { describe, expect, it } from "vitest";
import { complete, fresh } from "./setupDraft";

describe("setup draft", () => {
  it("keeps a signed-out draft for two hours and a signed-in one for a week", () => {
    const now = 10_000_000_000;
    expect(fresh({ at: now - 3_600_000 }, now, false)).toBe(true);
    expect(fresh({ at: now - 3 * 3_600_000 }, now, false)).toBe(false);
    expect(fresh({ at: now - 3 * 24 * 3_600_000 }, now, true)).toBe(true);
    expect(fresh({ at: now - 8 * 24 * 3_600_000 }, now, true)).toBe(false);
  });
  it("is complete only when campus, tenure and home are chosen", () => {
    const uni = { name: "X University" } as never;
    expect(complete({ uni, tenure: "first-year", living: "residence" })).toBe(true);
    expect(complete({ uni: null, tenure: "first-year", living: "residence" })).toBe(false);
    expect(complete({ uni, tenure: "", living: "residence" })).toBe(false);
    expect(complete({ uni, tenure: "first-year", living: null })).toBe(false);
  });
});
