import { describe, expect, it } from "vitest";
import { snapshotLine } from "./campusSnapshot";

describe("snapshot line", () => {
  it("says nothing without data or on a brand new campus", () => {
    expect(snapshotLine(null)).toBeNull();
    expect(snapshotLine({ events: 0, clubs: 0, students: null })).toBeNull();
  });
  it("joins what there is, with the right plurals", () => {
    expect(snapshotLine({ events: 1, clubs: 0, students: null })).toBe("1 event in the next two weeks");
    expect(snapshotLine({ events: 12, clubs: 1, students: null })).toBe("12 events in the next two weeks and 1 club");
    expect(snapshotLine({ events: 12, clubs: 8, students: 240 })).toBe("12 events in the next two weeks, 8 clubs and 240 students on Orbit");
  });
});
