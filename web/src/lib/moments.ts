import { commonFree, span, timeLabel, type Person } from "./freeTime";

/**
 * Orbit Moments: when the people in one of your circles line up, and what you could do with that time.
 * Pure and deterministic: no clock, no database. Authorization and hard rules come first and are never overridden by a score.
 * A person who has not shared is unknown, never free, and never counted.
 */
export type Interest = "food" | "study" | "social" | "sports" | "gaming" | "creative" | "club" | "outdoors";
export const INTERESTS: { id: Interest; label: string }[] = [
  { id: "food", label: "Food and coffee" }, { id: "study", label: "Study groups" }, { id: "social", label: "Hanging out" }, { id: "sports", label: "Sports" },
  { id: "gaming", label: "Gaming" }, { id: "creative", label: "Creative" }, { id: "club", label: "Club meetups" }, { id: "outdoors", label: "Outdoors" },
];

/** What kind of thing an event is, from its words. Simple on purpose: it only ever uses what the event itself says. */
export function categoryOf(e: { title: string; description?: string; host?: string }): Interest {
  const t = `${e.title} ${e.description ?? ""}`.toLowerCase();
  const has = (...w: string[]) => w.some((x) => new RegExp(`\\b${x}`).test(t));
  if (has("food", "lunch", "dinner", "brunch", "coffee", "pizza", "taco", "bbq", "cookout", "snack", "bake", "dessert", "tea ")) return "food";
  if (has("study", "tutor", "workshop", "exam", "homework", "office hours", "review session", "library", "career", "resume")) return "study";
  if (has("soccer", "basketball", "volleyball", "football", "tennis", "intramural", "fitness", "yoga", "run ", "5k", "gym", "swim", "pickup", "sport")) return "sports";
  if (has("hike", "outdoor", "picnic", "quad", "campfire", "garden", "walk", "kayak", "camping")) return "outdoors";
  if (has("game night", "gaming", "esports", "chess", "board game", "trivia", "smash", "arcade")) return "gaming";
  if (has("art", "music", "concert", "paint", "film", "movie", "dance", "theatre", "theater", "poetry", "open mic", "craft", "photo", "design")) return "creative";
  if (has("club", "meeting", "meetup", "society", "interest meeting", "general body")) return "club";
  return "social";
}

export type Circle = {
  id: string; name: string;
  /** Members who share their free time with you and may be counted. */
  members: Person[];
  /** Members who have not shared: unknown, left out. */
  unknown: string[];
  /** Everyone in the circle, you included. */
  total: number;
};

export type MomentEvent = { id: string; title: string; description?: string; place: string; startsAt: string; endsAt?: string; status: string; canceled: boolean; verified: boolean };

export type MomentPrefs = {
  enabled: boolean;
  interests: Interest[];
  /** Kinds of thing the student said not to suggest. */
  muted: Interest[];
  hiddenCircles: string[];
  /** Moments already dismissed, so they do not come back. */
  dismissed: string[];
  /** How often they showed interest in each kind (a small nudge to the ranking). */
  liked: Partial<Record<Interest, number>>;
};

export type Moment = {
  id: string;
  circleId: string; circleName: string;
  start: Date; end: Date;
  /** People free for all of it, you not included. */
  people: { id: string; name: string }[];
  unknown: string[];
  event?: { id: string; title: string; place: string; startsAt: string; category: Interest; verified: boolean };
  category: Interest;
  /** 0 to 100. */
  score: number;
  why: string[];
};

export const MIN_WINDOW = 45;
export const MIN_ELIGIBLE = 2; // you and at least one other person

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const HOUR = 3600_000;

export type Features = { time: number; group: number; interest: number; location: number; freshness: number };
/** The illustrative model from the spec: 30% time fit, 25% group, 20% interest, 15% location, 10% freshness. Weights are hypotheses, not measured. */
export const scoreOf = (f: Features) => 100 * (0.30 * clamp01(f.time) + 0.25 * clamp01(f.group) + 0.20 * clamp01(f.interest) + 0.15 * clamp01(f.location) + 0.10 * clamp01(f.freshness));

export function detectMoments(input: { now: Date; me: Person; circles: Circle[]; events: MomentEvent[]; prefs: MomentPrefs; days?: number; max?: number; minScore?: number }): Moment[] {
  const { now, me, circles, events, prefs, days = 7, max = 5, minScore = 50 } = input;
  if (!prefs.enabled) return [];
  const out: Moment[] = [];

  for (const circle of circles) {
    // Hard rules first: the circle is not hidden, and enough people have agreed to be counted.
    if (prefs.hiddenCircles.includes(circle.id)) continue;
    if (circle.members.length + 1 < MIN_ELIGIBLE) continue;
    const people = [me, ...circle.members];
    const windows = commonFree(people, now, { days, min: MIN_WINDOW, dayStart: 9 * 60, dayEnd: 21 * 60, after: now });

    for (const w of windows) {
      const candidates: { ev?: MomentEvent; start: Date; end: Date; category: Interest }[] = [];
      for (const e of events) {
        if (e.canceled || e.status !== "published") continue;
        const s = new Date(e.startsAt), en = e.endsAt ? new Date(e.endsAt) : new Date(s.getTime() + 2 * HOUR);
        const start = new Date(Math.max(s.getTime(), w.start.getTime())), end = new Date(Math.min(en.getTime(), w.end.getTime()));
        // It has to happen inside the shared window, for at least 30 minutes of it, and not already be over.
        if (end.getTime() - start.getTime() < 30 * 60000 || end.getTime() <= now.getTime()) continue;
        candidates.push({ ev: e, start, end, category: categoryOf(e) });
      }
      // With nothing on, a long enough opening is still worth a suggestion, but a weaker one.
      if (candidates.length === 0 && w.minutes >= 60) {
        const startMs = Math.max(w.start.getTime(), Math.ceil(now.getTime() / 900000) * 900000);
        const start = new Date(startMs), end = new Date(Math.min(w.end.getTime(), startMs + 90 * 60000));
        if (end.getTime() - start.getTime() >= 45 * 60000) candidates.push({ start, end, category: "social" });
      }

      for (const c of candidates) {
        if (prefs.muted.includes(c.category)) continue; // the student said not to suggest this kind of thing
        const id = `${circle.id}|${c.start.toISOString()}|${c.ev?.id ?? "open"}`;
        if (prefs.dismissed.includes(id)) continue;

        const dur = (c.end.getTime() - c.start.getTime()) / 60000;
        const insideW = c.ev ? clamp01(dur / Math.min(120, (new Date(c.ev.endsAt ?? new Date(new Date(c.ev.startsAt).getTime() + 2 * HOUR)).getTime() - new Date(c.ev.startsAt).getTime()) / 60000)) : clamp01(dur / 90);
        const likedBoost = clamp01((prefs.liked[c.category] ?? 0) / 4) * 0.4;
        const interest = prefs.interests.length === 0 ? 0.5 + likedBoost : prefs.interests.includes(c.category) ? clamp01(1) : clamp01(0.25 + likedBoost);
        const hoursAway = Math.max(0, (c.start.getTime() - now.getTime()) / HOUR);
        const f: Features = {
          time: c.ev ? (0.55 + 0.45 * insideW) : 0.45 * insideW + 0.2,
          group: circle.members.length / Math.max(1, circle.total - 1),
          interest,
          location: c.ev ? (c.ev.verified ? 0.85 : 0.65) : 0.5, // events have a real place; an open window does not
          freshness: hoursAway <= 24 ? 1 : hoursAway <= 72 ? 0.7 : 0.4,
        };
        const score = scoreOf(f) + (c.ev?.verified ? 3 : 0);
        if (score < minScore) continue;

        const why: string[] = [];
        why.push(`${circle.members.length + 1} of ${circle.total} in ${circle.name} may be free`);
        if (circle.unknown.length) why.push(`${circle.unknown.length} not sharing, so not counted`);
        if (c.ev) why.push(`${c.ev.title} is on during that time`);
        if (prefs.interests.includes(c.category) && c.ev) why.push("Matches what you like");
        out.push({
          id, circleId: circle.id, circleName: circle.name, start: c.start, end: c.end,
          people: circle.members.map((p) => ({ id: p.id, name: p.name })), unknown: circle.unknown,
          event: c.ev ? { id: c.ev.id, title: c.ev.title, place: c.ev.place, startsAt: c.ev.startsAt, category: c.category, verified: c.ev.verified } : undefined,
          category: c.category, score: Math.round(score), why,
        });
      }
    }
  }

  // Best first, one per circle per day, and a short list: this is a nudge, not a feed.
  out.sort((a, b) => b.score - a.score || a.start.getTime() - b.start.getTime());
  const seen = new Set<string>(), kept: Moment[] = [];
  for (const m of out) {
    const key = `${m.circleId}|${m.start.toDateString()}`;
    if (seen.has(key)) continue;
    seen.add(key); kept.push(m);
    if (kept.length >= max) break;
  }
  return kept;
}

/** The sentence a card opens with. */
export function headline(m: Moment): string {
  const n = m.people.length + 1;
  const who = n === 2 ? `You and ${m.people[0].name.split(" ")[0]}` : `${n} people in ${m.circleName}`;
  return m.event ? `${who} may be free for ${m.event.title}` : `${who} may be free together`;
}

/** "Thu, Oct 29 · 1:30 to 3:00 PM". */
export function whenLabel(m: Moment): string {
  const day = m.start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `${day} · ${timeLabel(m.start.getHours() * 60 + m.start.getMinutes())} to ${timeLabel(m.end.getHours() * 60 + m.end.getMinutes())}`;
}

export const lengthLabel = (m: Moment) => span(Math.round((m.end.getTime() - m.start.getTime()) / 60000));

export const EMPTY_PREFS: MomentPrefs = { enabled: false, interests: [], muted: [], hiddenCircles: [], dismissed: [], liked: {} };
