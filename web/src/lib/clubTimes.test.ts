import { describe, expect, it } from "vitest";
import { bestClubTimes } from "./clubTimes";
import type { ClubCount } from "./availability";

const total = 18;
/** Everyone free everywhere, then carve out busy stretches: busy[d] = list of [startSlot, endSlot, howManyBusy]. */
const grid = (busy: Record<number, [number, number, number][]> = {}): ClubCount[] => {
  const out: ClubCount[] = [];
  for (let d = 0; d < 7; d++) for (let g = 0; g < 48; g++) {
    const b = (busy[d] ?? []).filter(([s, e]) => g >= s && g < e).reduce((m, [, , n]) => Math.max(m, n), 0);
    out.push({ weekday: d, slot: g, free: total - b, total });
  }
  return out;
};

describe("club meeting times", () => {
  it("is empty when there are no counts", () => { expect(bestClubTimes([])).toEqual([]); });
  it("prefers the time most members are free", () => {
    // Tuesday 4:00 to 5:30 PM (slots 32 to 35): 10 busy. Everything else is free.
    const r = bestClubTimes(grid({ 2: [[32, 35, 10]] }), { duration: 60, max: 10 });
    const tue4 = r.find((t) => t.weekday === 2 && t.start === 16 * 60);
    expect(tue4?.free ?? 8).toBe(8);
    expect(r[0].free).toBe(18);
  });
  it("counts a meeting by its busiest half hour", () => {
    // Monday 4:00 free for 18, but 4:30 only 9 are free.
    const r = bestClubTimes(grid({ 1: [[33, 34, 9]] }), { duration: 60, earliest: 16 * 60, latest: 17 * 60 + 30, max: 20 });
    expect(r.find((t) => t.weekday === 1 && t.start === 16 * 60)?.free).toBe(9);
  });
  it("keeps results to the hours asked for and does not stack overlaps on one day", () => {
    const r = bestClubTimes(grid(), { duration: 120, earliest: 10 * 60, latest: 14 * 60, max: 30 });
    expect(r.every((t) => t.start >= 600 && t.end <= 840 && t.end - t.start === 120)).toBe(true);
    for (const a of r) for (const b of r) if (a !== b && a.weekday === b.weekday) expect(a.start < b.end && a.end > b.start).toBe(false);
  });
  it("reports the club size", () => { expect(bestClubTimes(grid())[0].total).toBe(18); });
});
