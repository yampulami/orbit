import type { ClassSlot } from "./classes";
import { toMinutes } from "./classes";

/** Free time, worked out from busy blocks. Pure: no database, no clock, so it can be tested. A "block" is a weekly stretch of time someone is busy, with no name or place. */
export type Block = { d: number; s: number; e: number };
export type Person = { id: string; name: string; blocks: Block[]; /** One-off busy stretches with real dates (a hangout, an event they are going to). */ dated?: { start: Date; end: Date }[] };
export type Window = { start: Date; end: Date; minutes: number; /** Who is free for all of it. */ who: string[] };

/** Classes turned into anonymous weekly blocks: what a friend is allowed to see. */
export function blocksFromClasses(slots: ClassSlot[]): Block[] {
  const out: Block[] = [];
  for (const c of slots) for (const d of c.days) out.push({ d, s: toMinutes(c.start), e: toMinutes(c.end) });
  return mergeBlocks(out);
}

/** Overlapping or touching blocks on the same day become one. */
export function mergeBlocks(blocks: Block[]): Block[] {
  const sorted = [...blocks].filter((b) => b.e > b.s).sort((a, b) => a.d - b.d || a.s - b.s);
  const out: Block[] = [];
  for (const b of sorted) {
    const last = out[out.length - 1];
    if (last && last.d === b.d && b.s <= last.e) last.e = Math.max(last.e, b.e);
    else out.push({ ...b });
  }
  return out;
}

type Span = [number, number];

/** The minutes of one calendar day a person is busy, as sorted, merged spans. */
function busySpans(p: Person, day: Date): Span[] {
  const spans: Span[] = p.blocks.filter((b) => b.d === day.getDay()).map((b) => [b.s, b.e]);
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  for (const x of p.dated ?? []) {
    const s = Math.max(0, Math.round((x.start.getTime() - dayStart) / 60000)), e = Math.min(1440, Math.round((x.end.getTime() - dayStart) / 60000));
    if (e > 0 && s < 1440 && e > s) spans.push([s, e]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const merged: Span[] = [];
  for (const sp of spans) {
    const last = merged[merged.length - 1];
    if (last && sp[0] <= last[1]) last[1] = Math.max(last[1], sp[1]);
    else merged.push([sp[0], sp[1]]);
  }
  return merged;
}

export type FreeOpts = {
  /** Earliest and latest minute of the day worth suggesting. Default 8:00 to 22:00. */
  dayStart?: number; dayEnd?: number;
  /** Shortest stretch worth showing, in minutes. Default 45. */
  min?: number;
  /** How many days to look at, starting with the day of `from`. Default 7. */
  days?: number;
  /** Do not return windows that began before this moment. */
  after?: Date;
};

/** When everyone given is free at once: stretches of at least `min` minutes, soonest first. Anyone with no blocks counts as free all day. */
export function commonFree(people: Person[], from: Date, opts: FreeOpts = {}): Window[] {
  const { dayStart = 8 * 60, dayEnd = 22 * 60, min = 45, days = 7, after = from } = opts;
  if (people.length === 0) return [];
  const out: Window[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const busy: Span[] = people.flatMap((p) => busySpans(p, day));
    busy.sort((a, b) => a[0] - b[0]);
    // Walk the day, keeping the stretches no one is busy.
    let cursor = dayStart;
    const gaps: Span[] = [];
    for (const [s, e] of busy) {
      if (s > cursor) gaps.push([cursor, Math.min(s, dayEnd)]);
      cursor = Math.max(cursor, e);
      if (cursor >= dayEnd) break;
    }
    if (cursor < dayEnd) gaps.push([cursor, dayEnd]);
    for (const [s0, e] of gaps) {
      const t0 = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, s0).getTime();
      // A window already under way starts from now, rounded up to the next five minutes.
      const startMs = Math.max(t0, Math.ceil(after.getTime() / 300000) * 300000);
      const endMs = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, e).getTime();
      const minutes = Math.round((endMs - startMs) / 60000);
      if (minutes >= min) out.push({ start: new Date(startMs), end: new Date(endMs), minutes, who: people.map((p) => p.id) });
    }
  }
  return out;
}

/** How long the person is free from `now` until their next busy stretch (or the end of the day), or 0 if they are busy right now. */
export function freeNow(p: Person, now: Date, dayEnd = 22 * 60): { minutes: number; until: Date } | null {
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins >= dayEnd) return null;
  const spans = busySpans(p, now);
  if (spans.some(([s, e]) => mins >= s && mins < e)) return null;
  const next = spans.find(([s]) => s > mins);
  const end = Math.min(next ? next[0] : dayEnd, dayEnd);
  return { minutes: end - mins, until: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, end) };
}

/** "45 min", "1 hr 30 min". */
export function span(minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
