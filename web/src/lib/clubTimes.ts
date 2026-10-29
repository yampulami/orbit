import type { ClubCount } from "./availability";

/** Turn a club's anonymous half-hour counts into the best repeating meeting times. Pure. A time is only as good as its worst half hour: if 14 are free at 4:00 and 9 at 4:30, a one-hour meeting at 4:00 counts 9. */
export type ClubTime = { weekday: number; start: number; end: number; free: number; total: number };

export function bestClubTimes(counts: ClubCount[], opts: { duration?: number; earliest?: number; latest?: number; max?: number } = {}): ClubTime[] {
  const { duration = 60, earliest = 9 * 60, latest = 21 * 60, max = 5 } = opts;
  const slots = Math.max(1, Math.round(duration / 30));
  const at = new Map(counts.map((c) => [c.weekday * 100 + c.slot, c]));
  const total = counts[0]?.total ?? 0;
  if (total === 0) return [];
  const out: ClubTime[] = [];
  for (let d = 0; d < 7; d++) {
    for (let g = Math.ceil(earliest / 30); g + slots <= Math.floor(latest / 30); g++) {
      let free = total;
      for (let k = 0; k < slots; k++) free = Math.min(free, at.get(d * 100 + g + k)?.free ?? 0);
      const weekdayBonus = d >= 1 && d <= 5 ? 0.4 : 0;
      out.push({ weekday: d, start: g * 30, end: (g + slots) * 30, free, total, ...{ score: free + weekdayBonus } } as ClubTime);
    }
  }
  (out as (ClubTime & { score: number })[]).sort((a, b) => b.score - a.score || a.weekday - b.weekday || a.start - b.start);
  const chosen: ClubTime[] = [];
  for (const t of out) {
    if (chosen.some((c) => c.weekday === t.weekday && t.start < c.end && t.end > c.start)) continue;
    const { score: _s, ...clean } = t as ClubTime & { score: number };
    chosen.push(clean);
    if (chosen.length >= max) break;
  }
  return chosen;
}
