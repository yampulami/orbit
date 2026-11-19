import { describe, expect, it } from "vitest";
import { busySpans, commonFree, mergeBlocks, suggestTimes, type Block, type Person } from "./freeTime";

/** Properties that must hold for any schedules, checked on many random ones (a small seeded generator, so a failure can be repeated). */
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
const int = (r: () => number, a: number, b: number) => a + Math.floor(r() * (b - a + 1));

function randomPeople(r: () => number, n: number): Person[] {
  return Array.from({ length: n }, (_, i) => {
    const blocks: Block[] = [];
    for (let k = int(r, 0, 6); k > 0; k--) {
      const s = int(r, 0, 1380), e = Math.min(1440, s + int(r, 15, 240));
      blocks.push({ d: int(r, 0, 6), s, e });
    }
    return { id: i === 0 ? "me" : `p${i}`, name: `P${i}`, blocks: mergeBlocks(blocks) };
  });
}
const FROM = new Date(2026, 9, 28, 6, 0); // a Wednesday morning
const minutesOf = (w: { start: Date; end: Date }) => (w.end.getTime() - w.start.getTime()) / 60000;
const clash = (p: Person, start: Date, end: Date) => {
  const day = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  // clock times, not elapsed time: on the day the clocks change they differ by an hour
  const s = start.getHours() * 60 + start.getMinutes(), e = end.getDate() !== start.getDate() ? 1440 : end.getHours() * 60 + end.getMinutes();
  return busySpans(p, day).some(([a, b]) => s < b && e > a);
};

describe("common free time, for any schedules", () => {
  it("stays inside the day, in order, never on top of anyone's busy time, never shorter than the minimum", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const r = rng(seed), people = randomPeople(r, int(r, 1, 6));
      const ws = commonFree(people, FROM, { days: 7, min: 45, dayStart: 8 * 60, dayEnd: 22 * 60 });
      let prevEnd = 0;
      for (const w of ws) {
        expect(minutesOf(w)).toBeGreaterThanOrEqual(45);
        expect(w.start.getTime()).toBeGreaterThanOrEqual(prevEnd);
        prevEnd = w.end.getTime();
        const mins = w.start.getHours() * 60 + w.start.getMinutes();
        expect(mins).toBeGreaterThanOrEqual(8 * 60 - 1);
        expect(w.end.getHours() * 60 + w.end.getMinutes() || 1440).toBeLessThanOrEqual(22 * 60);
        for (const p of people) expect(clash(p, w.start, w.end), `seed ${seed}, ${p.id}`).toBe(false);
      }
    }
  });

  it("never gains free time when another person joins the group", () => {
    for (let seed = 100; seed < 140; seed++) {
      const r = rng(seed), people = randomPeople(r, 5);
      const total = (ps: Person[]) => commonFree(ps, FROM, { days: 7, min: 15 }).reduce((a, w) => a + minutesOf(w), 0);
      for (let n = 1; n < people.length; n++) expect(total(people.slice(0, n + 1))).toBeLessThanOrEqual(total(people.slice(0, n)));
    }
  });
});

describe("suggestions, for any schedules", () => {
  it("only offers times nobody who is listed as free has a clash with, and honours the minimum and the required people", () => {
    for (let seed = 200; seed < 240; seed++) {
      const r = rng(seed), people = randomPeople(r, int(r, 2, 6));
      const k = int(r, 1, people.length), required = r() < 0.5 && people.length > 1 ? [people[1].id] : [];
      const out = suggestTimes(people, FROM, { days: 5, duration: 60, minAvailable: k, required, max: 50 });
      for (const s of out) {
        expect(s.available.length).toBeGreaterThanOrEqual(k);
        expect(s.available).toContain("me");
        for (const id of required) expect(s.available).toContain(id);
        for (const p of people) {
          const free = s.available.includes(p.id);
          expect(clash(p, s.start, s.end), `seed ${seed}, ${p.id}`).toBe(!free);
        }
      }
    }
  });

  it("offers a time when everyone has nothing on, and nothing when the organizer is busy all day", () => {
    const open: Person[] = [{ id: "me", name: "You", blocks: [] }, { id: "a", name: "A", blocks: [] }];
    expect(suggestTimes(open, FROM, { days: 1, duration: 60 }).length).toBeGreaterThan(0);
    const allDay: Person[] = [{ id: "me", name: "You", blocks: [{ d: 3, s: 0, e: 1440 }] }, { id: "a", name: "A", blocks: [] }];
    expect(suggestTimes(allDay, FROM, { days: 1, duration: 60, minAvailable: 1 })).toEqual([]);
  });

  it("treats k = 1 as 'anyone but the organizer must still be free' and k = everyone as 'all free'", () => {
    const people: Person[] = [
      { id: "me", name: "You", blocks: [] },
      { id: "a", name: "A", blocks: [{ d: 3, s: 0, e: 12 * 60 }] },
      { id: "b", name: "B", blocks: [{ d: 3, s: 12 * 60, e: 1440 }] },
    ];
    const everyone = suggestTimes(people, FROM, { days: 1, duration: 60, max: 50 });
    expect(everyone).toEqual([]); // A is busy all morning, B all afternoon: nobody is free together
    const two = suggestTimes(people, FROM, { days: 1, duration: 60, minAvailable: 2, max: 50 });
    expect(two.length).toBeGreaterThan(0);
    expect(two.every((s) => s.available.length === 2)).toBe(true);
  });
});

describe("blocks", () => {
  it("merges touching and nested blocks, and keeps different days apart", () => {
    expect(mergeBlocks([{ d: 1, s: 60, e: 120 }, { d: 1, s: 120, e: 180 }])).toEqual([{ d: 1, s: 60, e: 180 }]);
    expect(mergeBlocks([{ d: 1, s: 60, e: 300 }, { d: 1, s: 100, e: 200 }])).toEqual([{ d: 1, s: 60, e: 300 }]);
    expect(mergeBlocks([{ d: 1, s: 60, e: 120 }, { d: 2, s: 60, e: 120 }])).toHaveLength(2);
  });
  it("counts a block that ends exactly when a window starts as not clashing (half-open times)", () => {
    const p: Person = { id: "me", name: "You", blocks: [{ d: 3, s: 9 * 60, e: 10 * 60 }] };
    const day = new Date(2026, 9, 28);
    expect(clash(p, new Date(day.getTime() + 10 * 3600000), new Date(day.getTime() + 11 * 3600000))).toBe(false);
    expect(clash(p, new Date(day.getTime() + 9 * 3600000 + 59 * 60000), new Date(day.getTime() + 11 * 3600000))).toBe(true);
  });
});

describe("daylight saving", () => {
  // The first day in the next two years on which the local clock changes (none in zones without daylight saving, so the test is skipped there).
  const changeDay = (() => {
    const start = new Date(2026, 0, 1);
    for (let i = 0; i < 700; i++) {
      const a = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), b = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 1);
      if (a.getTimezoneOffset() !== b.getTimezoneOffset()) return b;
    }
    return null;
  })();
  it.skipIf(!changeDay)("keeps windows on the same clock times on the day the clocks change", () => {
    const day = changeDay!;
    const ws = commonFree([{ id: "me", name: "You", blocks: [] }], new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0), { days: 1, dayStart: 9 * 60, dayEnd: 17 * 60, min: 30 });
    expect(ws).toHaveLength(1);
    expect(ws[0].start.getHours()).toBe(9);
    expect(ws[0].end.getHours()).toBe(17);
  });
});
