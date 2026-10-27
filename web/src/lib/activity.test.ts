import { describe, expect, it } from "vitest";
import { activityOf } from "./activity";
import { permsOf } from "./clubRoles";
import { buildFeed, problemWithPoll, problemWithPost } from "./clubFeed";

const now = new Date(2026, 9, 27, 12, 0);
const day = (n: number) => new Date(now.getTime() + n * 86400000).toISOString();
const ev = (n: number) => ({ startsAt: day(n), status: "published", canceled: false });

describe("activityOf", () => {
  it("is active with an event coming up or a recent post", () => {
    expect(activityOf([ev(3)], undefined, now).level).toBe("active");
    expect(activityOf([], day(-2), now).level).toBe("active");
    expect(activityOf([ev(3)], day(-2), now).line).toBe("1 event this month · last post 2 days ago");
  });
  it("is steady, then quiet, as time passes with nothing happening", () => {
    expect(activityOf([ev(-45)], undefined, now).level).toBe("steady");
    expect(activityOf([], day(-20), now).level).toBe("steady");
    expect(activityOf([ev(-200)], day(-120), now).level).toBe("quiet");
  });
  it("ignores cancelled and unapproved events, and calls a fresh club new", () => {
    expect(activityOf([{ startsAt: day(2), status: "pending", canceled: false }, { startsAt: day(2), status: "published", canceled: true }], undefined, now).level).toBe("quiet");
    expect(activityOf([], undefined, now, day(-3)).level).toBe("new");
  });
});

describe("permsOf", () => {
  const roles = [{ id: "r1", permissions: ["announce", "bogus", "polls"] }, { id: "r2", permissions: [] }];
  it("gives the owner everything and a role exactly what it ticks", () => {
    expect(permsOf({ role: "owner" }, roles)).toHaveLength(7);
    expect(permsOf({ role: "officer", role_id: "r1" }, roles)).toEqual(["announce", "polls"]);
    expect(permsOf({ role: "officer", role_id: "r2" }, roles)).toEqual([]);
  });
  it("keeps older officers working and gives outsiders nothing", () => {
    expect(permsOf({ role: "officer" }, roles)).toEqual(["announce", "events", "polls"]);
    expect(permsOf(undefined, roles)).toEqual([]);
  });
});

describe("club feed", () => {
  const posts = [
    { id: "a", org_id: "o", author_id: "u1", kind: "post" as const, title: "", body: "hi", pinned: false, created_at: "2026-10-20T10:00:00Z" },
    { id: "b", org_id: "o", author_id: "u2", kind: "announcement" as const, title: "News", body: "", pinned: true, created_at: "2026-10-10T10:00:00Z" },
    { id: "c", org_id: "o", author_id: "u1", kind: "poll" as const, title: "Which?", body: "", pinned: false, created_at: "2026-10-25T10:00:00Z" },
  ];
  it("puts pinned first, then newest, and builds poll totals", () => {
    const feed = buildFeed(posts, [{ id: "k", post_id: "a", author_id: "u2", body: "yo", created_at: "2026-10-21T10:00:00Z" }],
      [{ id: "o1", post_id: "c", label: "A", position: 1 }, { id: "o2", post_id: "c", label: "B", position: 2 }],
      [{ post_id: "c", option_id: "o1", votes: 2, mine: true }, { post_id: "c", option_id: "o2", votes: 1, mine: false }], { u2: "Sam" }, "u1");
    expect(feed.map((p) => p.id)).toEqual(["b", "c", "a"]);
    const poll = feed[1];
    expect(poll.total).toBe(3);
    expect(poll.myVote).toBe("o1");
    expect(feed[2].comments[0]).toMatchObject({ author: "Sam", mine: false });
    expect(feed[2].author).toBe("You");
  });
  it("checks what people write", () => {
    expect(problemWithPost({ kind: "announcement", title: " ", body: "x" })).toMatch(/headline/);
    expect(problemWithPost({ kind: "post", title: "", body: "  " })).toMatch(/Write/);
    expect(problemWithPost({ kind: "post", title: "", body: "hello" })).toBeNull();
    expect(problemWithPoll("Which?", ["A"])).toMatch(/two choices/);
    expect(problemWithPoll("Which?", ["A", "a"])).toMatch(/same/);
    expect(problemWithPoll("Which?", ["A", "B"])).toBeNull();
  });
});
