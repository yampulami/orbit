import { describe, expect, it } from "vitest";
import { homeLine, interestsLine, stepNote } from "./setupPreview";

describe("setup preview", () => {
  it("says how Home will open for each way of living", () => {
    expect(homeLine("residence")).toMatch(/residents and roommates/);
    expect(homeLine("commute")).toMatch(/commuters/);
    expect(homeLine("off-campus")).toBe(homeLine("commute"));
    expect(homeLine("other")).toMatch(/newest first/);
    expect(homeLine(null)).toMatch(/tuned/);
  });
  it("lists interests briefly", () => {
    expect(interestsLine([])).toMatch(/newest first/);
    expect(interestsLine(["Events"])).toBe("Your For you feed leans toward events.");
    expect(interestsLine(["Events", "Study groups"])).toMatch(/events and study groups/);
    expect(interestsLine(["Events", "Study groups", "Campus help", "Meeting people"])).toMatch(/events, study groups and 2 more/);
  });
  it("names the campus in the first note once chosen", () => {
    expect(stepNote("campus", "Caldwell University")).toMatch(/at Caldwell University/);
    expect(stepNote("campus")).toMatch(/limited to/);
  });
});
