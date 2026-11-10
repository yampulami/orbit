import type { Row } from "./feedData";

/** How the feed is ordered. Plain rules, no hidden model: every number here is a hypothesis that can be tuned, and nothing about a student leaves their device.
 *
 *  Reposts: when a friend (or you) reposts a post, the original rises into the feed with "Jordan reposted" on it for REPOST_HOURS, then the repost drops away
 *  (it stays on that person's profile). Friends' reposts count most.
 *  For you: each post gets a score from how new it is, whether a friend reposted it, whether a friend wrote it, how much you have liked, replied to or reposted
 *  that person before, how well it matches what you said you like and what you have shown you like, and a little for how much others engaged.
 *  Everything: newest first (a post a friend has just reposted counts as new again). */
export const REPOST_HOURS = 3;

export type Topic = "food" | "study" | "social" | "sports" | "gaming" | "creative" | "club" | "outdoors";
const WORDS: Record<Topic, string[]> = {
  food: ["food", "lunch", "dinner", "brunch", "breakfast", "coffee", "pizza", "taco", "bbq", "cookout", "snack", "bake", "dessert", "dining", "cook", "meal"],
  study: ["study", "tutor", "workshop", "exam", "midterm", "final", "homework", "office hours", "library", "career", "resume", "lecture", "class", "quiz"],
  sports: ["soccer", "basketball", "volleyball", "football", "tennis", "intramural", "fitness", "yoga", "5k", "gym", "swim", "pickup", "sport", "frisbee", "workout"],
  outdoors: ["hike", "outdoor", "picnic", "quad", "campfire", "garden", "kayak", "camping", "trail", "bike"],
  gaming: ["game night", "gaming", "esports", "chess", "board game", "trivia", "smash", "arcade", "minecraft"],
  creative: ["art", "music", "concert", "paint", "film", "movie", "dance", "theatre", "theater", "poetry", "open mic", "craft", "photo", "design", "band"],
  club: ["club", "meeting", "meetup", "society", "general body", "officer", "robotics"],
  social: ["party", "hangout", "hang out", "social", "friends", "mixer", "lounge", "roommate"],
};

/** What a post is about, from its words. A post can be about several things, or none. */
export function topicsOf(text: string): Topic[] {
  const t = text.toLowerCase();
  return (Object.keys(WORDS) as Topic[]).filter((k) => WORDS[k].some((w) => new RegExp(`\\b${w}`).test(t)));
}

/** What a student has shown they like: how much they have engaged with each person and each kind of thing (fades over weeks; see feedSignals). */
export type Signals = { authors: Record<string, number>; topics: Record<string, number> };
export const NO_SIGNALS: Signals = { authors: {}, topics: {} };

export const WEIGHTS = {
  halfLifeHours: 8, recency: 4,
  friendRepost: 3, extraRepost: 0.5,
  friendAuthor: 1.2,
  affinity: 0.4, affinityCap: 2,
  declared: 1, learned: 0.25, learnedCap: 1.5, topicCap: 2.5,
  popularity: 1,
  justPosted: 5, justPostedMinutes: 15,
} as const;

export type Item = { row: Row; score: number; /** Newest first. */ repostedBy: { id: string; name: string }[]; /** When it last became news: the post, or its newest repost. */ at: number };
export type RankInput = {
  rows: Row[];
  /** Finds a post that is not in `rows` (an older one that was reposted). */
  lookup?: (id: string) => Row | null | undefined;
  now: number; me: string; friends: Set<string>; interests: string[]; signals: Signals;
  mode: "forYou" | "latest";
};

const hours = (ms: number) => Math.max(0, ms / 3_600_000);
const textOf = (r: Row) => r.payload.body ?? r.payload.text ?? "";

export function scorePost(row: Row, at: number, repostCount: number, i: Pick<RankInput, "now" | "me" | "friends" | "interests" | "signals">): number {
  const W = WEIGHTS;
  let s = W.recency * Math.pow(0.5, hours(i.now - at) / W.halfLifeHours);
  if (repostCount > 0) s += W.friendRepost + W.extraRepost * Math.min(2, repostCount - 1);
  if (i.friends.has(row.author_id)) s += W.friendAuthor;
  s += Math.min(W.affinityCap, W.affinity * (i.signals.authors[row.author_id] ?? 0));
  let t = 0;
  for (const topic of topicsOf(textOf(row))) {
    if (i.interests.includes(topic)) t += W.declared;
    t += Math.min(W.learnedCap, W.learned * (i.signals.topics[topic] ?? 0));
  }
  s += Math.min(W.topicCap, t);
  s += W.popularity * Math.min(1, Math.log2(1 + row.post_likes.length + 2 * row.post_comments.length) / 5);
  // What you have just written stays at the top, so posting never feels like it vanished.
  if (row.author_id === i.me && hours(i.now - Date.parse(row.created_at)) * 60 < W.justPostedMinutes) s += W.justPosted;
  return s;
}

/** Never three posts in a row from the same person: when the next one would make three, take the best one from someone else. */
function spread(sorted: Item[]): Item[] {
  const pool = [...sorted], out: Item[] = [];
  while (pool.length) {
    const a = out[out.length - 1]?.row.author_id, b = out[out.length - 2]?.row.author_id;
    const k = a && a === b ? pool.findIndex((x) => x.row.author_id !== a) : 0;
    out.push(...pool.splice(k < 0 ? 0 : k, 1));
  }
  return out;
}

export function rankFeed(i: RankInput): Item[] {
  const posts = new Map(i.rows.filter((r) => !r.payload.repostOf).map((r) => [r.id, r]));
  // Reposts by friends (or you) that are still fresh. One person counts once per post.
  const by = new Map<string, { id: string; name: string; at: number }[]>();
  for (const r of i.rows) {
    const orig = r.payload.repostOf;
    if (!orig || hours(i.now - Date.parse(r.created_at)) > REPOST_HOURS || !(i.friends.has(r.author_id) || r.author_id === i.me)) continue;
    const list = by.get(orig) ?? [];
    const at = Date.parse(r.created_at), had = list.find((x) => x.id === r.author_id);
    if (had) had.at = Math.max(had.at, at); else list.push({ id: r.author_id, name: r.author_name, at });
    by.set(orig, list);
  }
  for (const id of by.keys()) if (!posts.has(id)) { const row = i.lookup?.(id); if (row && !row.payload.repostOf) posts.set(id, row); }

  const items: Item[] = [...posts.values()].map((row) => {
    const reposters = (by.get(row.id) ?? []).sort((a, b) => b.at - a.at);
    const at = Math.max(Date.parse(row.created_at), reposters[0]?.at ?? 0);
    return { row, at, repostedBy: reposters.map(({ id, name }) => ({ id, name })), score: scorePost(row, at, reposters.length, i) };
  });
  if (i.mode === "latest") return items.sort((a, b) => b.at - a.at || a.row.id.localeCompare(b.row.id));
  return spread(items.sort((a, b) => b.score - a.score || b.at - a.at));
}
