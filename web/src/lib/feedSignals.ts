import type { Row } from "./feedData";
import { topicsOf, type Signals } from "./feedRank";

/** What the student has shown they like, kept on this device only: how much they have liked, replied to, reposted or quoted each person and each kind of post.
 *  It fades with a two-week half life, so the feed follows what they like now, not what they liked in September. */
export const SIGNAL_WEIGHT = { like: 1, reply: 1.5, repost: 2, quote: 2 } as const;
const CAP = 20;
const HALF_LIFE_DAYS = 14;
const key = (me: string) => `orbit-feed-signals-v1:${me}`;

/** Pure: everything counts for less the longer ago it was recorded, and what has faded to almost nothing is forgotten. */
export function fade(s: Signals, days: number): Signals {
  const k = days > 0 ? Math.pow(0.5, days / HALF_LIFE_DAYS) : 1;
  const shrink = (m: Record<string, number>) => Object.fromEntries(Object.entries(m).map(([a, n]) => [a, n * k] as const).filter(([, n]) => n >= 0.05));
  return { authors: shrink(s.authors), topics: shrink(s.topics) };
}

/** Pure: one more thing the student did with a post. Your own posts teach nothing, and no one counts for more than CAP. */
export function withSignal(s: Signals, row: Row, weight: number, me: string): Signals {
  if (row.author_id === me) return s;
  const bump = (m: Record<string, number>, k: string) => ({ ...m, [k]: Math.min(CAP, (m[k] ?? 0) + weight) });
  let topics = s.topics;
  for (const t of topicsOf(row.payload.body ?? row.payload.text ?? "")) topics = bump(topics, t);
  return { authors: bump(s.authors, row.author_id), topics };
}

export function loadSignals(me: string): Signals {
  try {
    const raw = JSON.parse(localStorage.getItem(key(me)) ?? "null") as { authors?: Record<string, number>; topics?: Record<string, number>; at?: number } | null;
    if (!raw) return { authors: {}, topics: {} };
    return fade({ authors: raw.authors ?? {}, topics: raw.topics ?? {} }, raw.at ? (Date.now() - raw.at) / 864e5 : 0);
  } catch { return { authors: {}, topics: {} }; }
}

export function recordSignal(me: string, row: Row, kind: keyof typeof SIGNAL_WEIGHT) {
  if (!me) return;
  try {
    const next = withSignal(loadSignals(me), row, SIGNAL_WEIGHT[kind], me);
    localStorage.setItem(key(me), JSON.stringify({ ...next, at: Date.now() }));
  } catch { /* storage unavailable: the feed just does not learn */ }
}
