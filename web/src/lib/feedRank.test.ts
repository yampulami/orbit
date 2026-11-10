import { describe, expect, it } from "vitest";
import { NO_SIGNALS, REPOST_HOURS, rankFeed, topicsOf, type RankInput } from "./feedRank";
import { fade, withSignal } from "./feedSignals";
import type { Row } from "./feedData";

const NOW = Date.parse("2026-11-10T12:00:00Z");
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const post = (id: string, by: string, body: string, h: number, extra: Partial<Row> = {}): Row => ({ id, author_id: by, author_name: by, kind: "post", community: "Everyone", created_at: ago(h), payload: { body }, post_likes: [], post_comments: [], ...extra });
const repost = (id: string, by: string, of: string, h: number): Row => ({ ...post(id, by, "copy", h), payload: { body: "copy", repostOf: of, repostName: "x" } });
const base = (over: Partial<RankInput> = {}): RankInput => ({ rows: [], now: NOW, me: "me", friends: new Set(), interests: [], signals: NO_SIGNALS, mode: "forYou", ...over });
const ids = (items: { row: Row }[]) => items.map((x) => x.row.id);

describe("reposts in the feed", () => {
  it("a friend's fresh repost brings the original up with their name on it", () => {
    const rows = [post("old", "sam", "Free pizza tonight", 9), post("new", "lee", "Hello", 0.2), repost("r", "jo", "old", 1)];
    const out = rankFeed(base({ rows, friends: new Set(["jo"]) }));
    expect(ids(out)[0]).toBe("old");
    expect(out[0].repostedBy).toEqual([{ id: "jo", name: "jo" }]);
    expect(ids(out)).not.toContain("r"); // the repost itself is not a second post
  });
  it("a repost disappears from the feed after a few hours", () => {
    const rows = [post("old", "sam", "Free pizza tonight", 9), repost("r", "jo", "old", REPOST_HOURS + 0.5)];
    const out = rankFeed(base({ rows, friends: new Set(["jo"]) }));
    expect(out.find((x) => x.row.id === "old")?.repostedBy).toEqual([]);
  });
  it("reposts by people who are not your friends are ignored, yours are not", () => {
    const rows = [post("a", "sam", "x", 5), repost("r1", "stranger", "a", 0.5), repost("r2", "me", "a", 0.5)];
    const out = rankFeed(base({ rows, friends: new Set() }));
    expect(out[0].repostedBy.map((r) => r.id)).toEqual(["me"]);
  });
  it("lists each friend once and the newest first", () => {
    const rows = [post("a", "sam", "x", 5), repost("r1", "jo", "a", 2), repost("r2", "lee", "a", 1), repost("r3", "jo", "a", 0.5)];
    const out = rankFeed(base({ rows, friends: new Set(["jo", "lee"]) }));
    expect(out[0].repostedBy.map((r) => r.id)).toEqual(["jo", "lee"]);
  });
  it("finds an older reposted post that is not in the loaded list", () => {
    const rows = [repost("r", "jo", "gone", 1)];
    const found = post("gone", "sam", "Open mic night", 40);
    expect(ids(rankFeed(base({ rows, friends: new Set(["jo"]), lookup: (id) => (id === "gone" ? found : null) })))).toEqual(["gone"]);
    expect(rankFeed(base({ rows, friends: new Set(["jo"]) }))).toEqual([]);
  });
});

describe("ordering For you", () => {
  it("what a friend reposted beats a slightly newer post from a stranger", () => {
    const rows = [post("friendsPick", "sam", "Study group", 5), post("fresh", "zed", "Hello there", 1), repost("r", "jo", "friendsPick", 1)];
    expect(ids(rankFeed(base({ rows, friends: new Set(["jo"]) })))[0]).toBe("friendsPick");
  });
  it("a friend's own post beats an equally new post from a stranger", () => {
    const rows = [post("s", "stranger", "Hello", 1), post("f", "friend", "Hello", 1)];
    expect(ids(rankFeed(base({ rows, friends: new Set(["friend"]) })))[0]).toBe("f");
  });
  it("posts about what you like come first, whether you said so or showed it", () => {
    const rows = [post("a", "x", "Soccer pickup at the quad", 2), post("b", "y", "Library is quiet today", 2)];
    expect(ids(rankFeed(base({ rows, interests: ["sports"] })))[0]).toBe("a");
    expect(ids(rankFeed(base({ rows, signals: { authors: {}, topics: { study: 4 } } })))[0]).toBe("b");
  });
  it("people you have engaged with before rise", () => {
    const rows = [post("a", "x", "Hello", 2), post("b", "y", "Hello", 2)];
    expect(ids(rankFeed(base({ rows, signals: { authors: { y: 3 }, topics: {} } })))[0]).toBe("b");
  });
  it("newer beats older when nothing else differs, and a post of yours you just wrote is on top", () => {
    const rows = [post("old", "x", "Hello", 12), post("new", "y", "Hello", 1), post("mine", "me", "Hello", 0.1)];
    expect(ids(rankFeed(base({ rows })))).toEqual(["mine", "new", "old"]);
  });
  it("never puts three posts from one person in a row", () => {
    const rows = [post("a1", "a", "Hello", 1), post("a2", "a", "Hello", 1.1), post("a3", "a", "Hello", 1.2), post("b1", "b", "Hello", 3)];
    const out = ids(rankFeed(base({ rows })));
    expect(out.indexOf("b1")).toBeLessThan(3);
  });
});

describe("Everything stays newest first", () => {
  it("orders by time, and a freshly reposted post counts as new", () => {
    const rows = [post("a", "x", "Hello", 4), post("b", "y", "Hello", 2), post("c", "z", "Hello", 6), repost("r", "jo", "c", 0.5)];
    expect(ids(rankFeed(base({ rows, friends: new Set(["jo"]), mode: "latest" })))).toEqual(["c", "b", "a"]);
  });
});

describe("what a post is about", () => {
  it("reads topics from the words, any number of them or none", () => {
    expect(topicsOf("Free pizza at the library")).toEqual(expect.arrayContaining(["food", "study"]));
    expect(topicsOf("zzz qqq")).toEqual([]);
  });
});

describe("remembering what you like", () => {
  const liked = post("p", "sam", "Soccer on the quad", 1);
  it("counts the person and the topics, but not your own posts", () => {
    const s = withSignal(NO_SIGNALS, liked, 1, "me");
    expect(s.authors.sam).toBe(1);
    expect(s.topics.sports).toBe(1);
    expect(withSignal(NO_SIGNALS, liked, 1, "sam")).toEqual(NO_SIGNALS);
  });
  it("is capped, fades with time, and forgets what has faded away", () => {
    let s = NO_SIGNALS;
    for (let i = 0; i < 40; i++) s = withSignal(s, liked, 2, "me");
    expect(s.authors.sam).toBe(20);
    expect(fade(s, 14).authors.sam).toBeCloseTo(10, 5);
    expect(fade({ authors: { a: 0.04 }, topics: {} }, 0).authors).toEqual({});
  });
});
