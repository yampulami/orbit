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
export function busySpans(p: Person, day: Date): Span[] {
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

/* ---------- schedule sync: ranked suggestions ---------- */

export type SyncOpts = {
  /** How long the plan lasts, in minutes. Default 60. */
  duration?: number;
  /** How many days to look at, starting today. Default 7. */
  days?: number;
  /** The earliest a plan may start and the latest it may end, in minutes after midnight. Default 9:00 and 21:30. */
  earliest?: number; latest?: number;
  /** Space to keep before and after each busy stretch, so nobody is racing from class. Default 0. */
  buffer?: number;
  /** Only times when everybody is free. When false, times that most people can make are shown too, with who is missing. Default true. */
  everyone?: boolean;
  /** How many suggestions to return. Default 6. */
  max?: number;
};

export type Suggestion = {
  start: Date; end: Date;
  /** Ids of the people free for all of it, and of those who are not. */
  available: string[]; missing: string[];
  score: number;
  best: boolean;
  /** Plain reasons, best first: "Everyone is free", "Sam has class right before", ... */
  reasons: string[];
};

const STEP = 30;
const fmt = (m: number) => { const h = Math.floor(m / 60), mm = m % 60; return new Date(2000, 0, 1, h, mm).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };

/** Rank the times that work for a group. Pure: no clock, no database. Scores favour more people free, daytime and meal times, comfortable gaps and sooner. */
export function suggestTimes(people: Person[], now: Date, opts: SyncOpts = {}): Suggestion[] {
  const { duration = 60, days = 7, earliest = 9 * 60, latest = 21 * 60 + 30, buffer = 0, everyone = true, max = 6 } = opts;
  if (people.length === 0 || duration < 15) return [];
  const need = everyone ? people.length : Math.max(2, Math.ceil(people.length / 2));
  const out: Suggestion[] = [];

  for (let i = 0; i < days; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const spans = people.map((p) => busySpans(p, day));
    const nowMin = i === 0 ? now.getHours() * 60 + now.getMinutes() : -1;
    const first = Math.max(earliest, nowMin < 0 ? 0 : Math.ceil((nowMin + 5) / STEP) * STEP);
    for (let t = Math.ceil(first / STEP) * STEP; t + duration <= latest; t += STEP) {
      const end = t + duration;
      const available: string[] = [], missing: string[] = [];
      const notes: string[] = [];
      let comfort = 0;
      people.forEach((p, k) => {
        const clash = spans[k].some(([s, e]) => t < e + buffer && end > s - buffer);
        if (clash) { missing.push(p.id); return; }
        available.push(p.id);
        // How close is the nearest busy stretch on either side?
        const before = spans[k].filter(([, e]) => e <= t).map(([, e]) => t - e);
        const after = spans[k].filter(([s]) => s >= end).map(([s]) => s - end);
        const gap = Math.min(before.length ? Math.min(...before) : 999, after.length ? Math.min(...after) : 999);
        if (gap < 15) { comfort -= 6; notes.push(`${p.id === "me" ? "You have" : `${p.name.split(" ")[0]} has`} something right ${before.length && Math.min(...before) < 15 ? "before" : "after"}`); }
        else if (gap >= 30) comfort += 1.5;
      });
      if (available.length < need) continue;
      let score = (available.length / people.length) * 100 + comfort;
      if (t >= 10 * 60 && end <= 20 * 60) score += 8;
      if ((t >= 11 * 60 + 30 && t <= 13 * 60) || (t >= 17 * 60 && t <= 19 * 60)) score += 5; // lunch and dinner are natural times to meet
      if (t < 9 * 60) score -= 10;
      if (end > 21 * 60) score -= 8;
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, t);
      score -= Math.min(10, Math.max(0, (start.getTime() - now.getTime()) / 3600000) / 12); // a little preference for sooner
      const reasons: string[] = [];
      if (missing.length === 0) reasons.push(people.length === 1 ? "Nothing else is on" : "Everyone is free");
      else reasons.push(`${available.length} of ${people.length} free`);
      if (comfort >= people.length * 1.5 - 0.01 && missing.length === 0) reasons.push("Comfortable gaps around it");
      reasons.push(...notes.slice(0, 2));
      if ((t >= 11 * 60 + 30 && t <= 13 * 60)) reasons.push("Lunchtime");
      else if (t >= 17 * 60 && t <= 19 * 60) reasons.push("Around dinner");
      out.push({ start, end: new Date(start.getTime() + duration * 60000), available, missing, score, best: false, reasons });
    }
  }

  // Take the best, without piling several that overlap on the same stretch.
  out.sort((a, b) => b.score - a.score || a.start.getTime() - b.start.getTime());
  const chosen: Suggestion[] = [];
  for (const s of out) {
    if (chosen.some((c) => s.start.getTime() < c.end.getTime() && s.end.getTime() > c.start.getTime())) continue;
    chosen.push(s);
    if (chosen.length >= max) break;
  }
  if (chosen[0]) chosen[0].best = true;
  return chosen;
}

export type WeeklySlot = { weekday: number; start: number; end: number; available: string[]; missing: string[]; score: number };

/** The best times that repeat every week, looking only at weekly classes (not one-off plans). For a club or a study group that meets regularly. */
export function weeklyTimes(people: Person[], opts: Pick<SyncOpts, "duration" | "earliest" | "latest" | "buffer" | "everyone" | "max"> = {}): WeeklySlot[] {
  const { duration = 60, earliest = 9 * 60, latest = 21 * 60, buffer = 0, everyone = true, max = 6 } = opts;
  if (people.length === 0) return [];
  const need = everyone ? people.length : Math.max(2, Math.ceil(people.length / 2));
  const out: WeeklySlot[] = [];
  for (let d = 0; d < 7; d++) {
    const spans = people.map((p) => p.blocks.filter((b) => b.d === d).map((b): [number, number] => [b.s, b.e]));
    for (let t = Math.ceil(earliest / STEP) * STEP; t + duration <= latest; t += STEP) {
      const available: string[] = [], missing: string[] = [];
      people.forEach((p, k) => (spans[k].some(([s, e]) => t < e + buffer && t + duration > s - buffer) ? missing : available).push(p.id));
      if (available.length < need) continue;
      let score = (available.length / people.length) * 100;
      if (d >= 1 && d <= 5) score += 6; // weekdays
      if (t >= 10 * 60 && t + duration <= 20 * 60) score += 6;
      out.push({ weekday: d, start: t, end: t + duration, available, missing, score });
    }
  }
  out.sort((a, b) => b.score - a.score || a.weekday - b.weekday || a.start - b.start);
  const chosen: WeeklySlot[] = [];
  for (const s of out) {
    if (chosen.some((c) => c.weekday === s.weekday && s.start < c.end && s.end > c.start)) continue;
    chosen.push(s);
    if (chosen.length >= max) break;
  }
  return chosen;
}

export const timeLabel = fmt;
