import { describe, expect, it } from "vitest";
import { blocksFromClasses, commonFree, freeNow, mergeBlocks, span, type Person } from "./freeTime";

// Wednesday 28 Oct 2026 (weekday 3)
const at = (h: number, m = 0, day = 28) => new Date(2026, 9, day, h, m);
const cls = (days: number[], start: string, end: string) => ({ id: Math.random().toString(), name: "Secret class", days, start, end });
const me = (blocks: Person["blocks"], dated?: Person["dated"]): Person => ({ id: "me", name: "You", blocks, dated });
const sam = (blocks: Person["blocks"]): Person => ({ id: "sam", name: "Sam", blocks });

describe("blocks", () => {
  it("turns classes into anonymous weekly blocks", () => {
    const b = blocksFromClasses([cls([1, 3], "09:00", "10:15")]);
    expect(b).toEqual([{ d: 1, s: 540, e: 615 }, { d: 3, s: 540, e: 615 }]);
    expect(JSON.stringify(b)).not.toMatch(/Secret/);
  });
  it("merges overlapping and touching blocks on a day, not across days", () => {
    expect(mergeBlocks([{ d: 3, s: 600, e: 660 }, { d: 3, s: 650, e: 700 }, { d: 3, s: 700, e: 720 }, { d: 4, s: 600, e: 660 }])).toEqual([{ d: 3, s: 600, e: 720 }, { d: 4, s: 600, e: 660 }]);
  });
});

describe("common free time", () => {
  it("is the day between classes, for one person", () => {
    const w = commonFree([me([{ d: 3, s: 600, e: 675 }, { d: 3, s: 780, e: 810 }])], at(7), { days: 1 });
    expect(w.map((x) => [x.start.getHours() * 60 + x.start.getMinutes(), x.end.getHours() * 60 + x.end.getMinutes()])).toEqual([[480, 600], [675, 780], [810, 1320]]);
  });
  it("needs everyone to be free at once", () => {
    const w = commonFree([me([{ d: 3, s: 600, e: 720 }]), sam([{ d: 3, s: 660, e: 840 }])], at(7), { days: 1, min: 30 });
    // busy 10:00 to 14:00 combined, so free 8:00-10:00 and 14:00-22:00
    expect(w.map((x) => x.start.getHours())).toEqual([8, 14]);
    expect(w[0].who).toEqual(["me", "sam"]);
  });
  it("drops stretches shorter than the minimum", () => {
    const w = commonFree([me([{ d: 3, s: 480, e: 540 }, { d: 3, s: 570, e: 1320 }])], at(7), { days: 1, min: 45 });
    expect(w).toEqual([]);
  });
  it("starts a window that is already under way from now", () => {
    const w = commonFree([me([])], at(14, 2), { days: 1 });
    expect(w).toHaveLength(1);
    expect(w[0].start.getHours()).toBe(14);
    expect(w[0].start.getMinutes()).toBe(5);
  });
  it("counts one-off plans as busy", () => {
    const w = commonFree([me([], [{ start: at(12), end: at(14) }])], at(7), { days: 1, min: 60 });
    expect(w.map((x) => x.start.getHours())).toEqual([8, 14]);
  });
  it("looks across days and treats the right weekday only", () => {
    const w = commonFree([me([{ d: 4, s: 480, e: 1320 }])], at(7), { days: 3, min: 60 });
    expect(w.map((x) => x.start.getDate())).toEqual([28, 30]); // Thursday the 29th is booked solid
  });
  it("finds nothing for nobody", () => {
    expect(commonFree([], at(7))).toEqual([]);
  });
});

describe("free right now", () => {
  it("says how long until the next class", () => {
    const f = freeNow(me([{ d: 3, s: 840, e: 900 }]), at(13, 10))!;
    expect(f.minutes).toBe(50);
    expect(f.until.getHours()).toBe(14);
  });
  it("is null in class and late at night", () => {
    expect(freeNow(me([{ d: 3, s: 780, e: 840 }]), at(13, 10))).toBeNull();
    expect(freeNow(me([]), at(22, 30))).toBeNull();
  });
  it("runs to the end of the day with nothing left", () => {
    expect(freeNow(me([{ d: 3, s: 480, e: 540 }]), at(20, 0))!.minutes).toBe(120);
  });
});

describe("span", () => {
  it("reads naturally", () => { expect([span(45), span(60), span(90)]).toEqual(["45 min", "1 hr", "1 hr 30 min"]); });
});
