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
    expect(permsOf({ role: "owner" }, roles)).toHaveLength(8);
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

import { buildChannels, buildMessages, channelSlug, problemWithChannel } from "./clubChat";
describe("club chat", () => {
  const chans = [
    { id: "c2", org_id: "o", name: "build", description: "", team_only: false, is_default: false, position: 1 },
    { id: "c1", org_id: "o", name: "general", description: "", team_only: false, is_default: true, position: 0 },
    { id: "c3", org_id: "o", name: "officers", description: "", team_only: true, is_default: false, position: 2 },
  ];
  const msgs = [
    { id: "a", channel_id: "c1", org_id: "o", author_id: "u2", body: "hi", created_at: "2026-10-27T10:00:00Z" },
    { id: "b", channel_id: "c1", org_id: "o", author_id: "u2", body: "again", created_at: "2026-10-27T12:00:00Z" },
    { id: "c", channel_id: "c1", org_id: "o", author_id: "u1", body: "mine", created_at: "2026-10-27T12:30:00Z" },
    { id: "d", channel_id: "c2", org_id: "o", author_id: "u2", body: "x", created_at: "2026-10-27T09:00:00Z" },
  ];
  it("puts #general first and counts what others wrote after you last read", () => {
    const list = buildChannels(chans, msgs, [{ channel_id: "c1", last_read_at: "2026-10-27T11:00:00Z" }], "u1");
    expect(list.map((c) => c.name)).toEqual(["general", "build", "officers"]);
    expect(list[0].unread).toBe(1); // only the 12:00 message from someone else is after the marker
    expect(list[1].unread).toBe(1); // never read
    expect(list[2].unread).toBe(0);
    expect(list[0].lastAt).toBe("2026-10-27T12:30:00Z");
  });
  it("lists a channel's messages oldest first with who wrote them", () => {
    const m = buildMessages(msgs, "c1", { u2: "Sam" }, "u1");
    expect(m.map((x) => x.body)).toEqual(["hi", "again", "mine"]);
    expect(m[0]).toMatchObject({ author: "Sam", mine: false });
    expect(m[2]).toMatchObject({ author: "You", mine: true });
  });
  it("turns what people type into a channel name and refuses duplicates", () => {
    expect(channelSlug("  Build Night! ")).toBe("build-night");
    expect(channelSlug("***")).toBe("");
    expect(problemWithChannel("***", [])).toMatch(/name/);
    expect(problemWithChannel("General", ["general"])).toMatch(/already/);
    expect(problemWithChannel("Study group", ["general"])).toBeNull();
  });
});

import { buildTasks, isOverdue, problemWithTask } from "./clubTasks";
describe("club tasks", () => {
  const now = new Date(2026, 9, 27, 12, 0);
  const iso = (n: number) => new Date(now.getTime() + n * 86400000).toISOString();
  const raw = [
    { id: "a", org_id: "o", title: "Later", details: "", assignee_id: "u1", due_at: iso(5), status: "todo" as const, created_by: "u1", created_at: iso(-3), done_at: null },
    { id: "b", org_id: "o", title: "Soon", details: "", assignee_id: "u2", due_at: iso(1), status: "doing" as const, created_by: "u1", created_at: iso(-2), done_at: null },
    { id: "c", org_id: "o", title: "No date", details: "", assignee_id: null, due_at: null, status: "todo" as const, created_by: "u1", created_at: iso(-4), done_at: null },
    { id: "d", org_id: "o", title: "Finished", details: "", assignee_id: "u1", due_at: iso(-2), status: "done" as const, created_by: "u1", created_at: iso(-8), done_at: iso(-3) },
    { id: "e", org_id: "o", title: "Late", details: "", assignee_id: "u2", due_at: iso(-1), status: "todo" as const, created_by: "u1", created_at: iso(-7), done_at: null },
  ];
  it("lists open tasks by due date, undated after dated, and finished last", () => {
    const t = buildTasks(raw, { u2: "Sam" }, "u1");
    expect(t.map((x) => x.id)).toEqual(["e", "b", "a", "c", "d"]);
    expect(t[1]).toMatchObject({ assignee: "Sam", mine: false });
    expect(t[2]).toMatchObject({ assignee: "You", mine: true });
  });
  it("calls a task overdue only when it is open and past due", () => {
    const t = buildTasks(raw, {}, "u1");
    expect(t.filter((x) => isOverdue(x, now)).map((x) => x.id)).toEqual(["e"]);
  });
  it("checks a new task", () => {
    expect(problemWithTask({ title: " ", details: "" })).toMatch(/title/);
    expect(problemWithTask({ title: "Do it", details: "x".repeat(501) })).toMatch(/500/);
    expect(problemWithTask({ title: "Do it", details: "" })).toBeNull();
  });
});

import { checkinOpen, checkinUrl, demoCode, slotAt } from "./checkin";
describe("check-in", () => {
  const start = new Date(2026, 9, 27, 18, 0);
  const iso = (h: number) => new Date(start.getTime() + h * 3600000).toISOString();
  it("opens an hour before and closes an hour after the end", () => {
    const e = { startsAt: iso(0), endsAt: iso(2) };
    expect(checkinOpen(e, new Date(start.getTime() - 2 * 3600000))).toBe(false);
    expect(checkinOpen(e, new Date(start.getTime() - 30 * 60000))).toBe(true);
    expect(checkinOpen(e, new Date(start.getTime() + 2.5 * 3600000))).toBe(true);
    expect(checkinOpen(e, new Date(start.getTime() + 3.5 * 3600000))).toBe(false);
  });
  it("treats an event with no end as three hours long", () => {
    const e = { startsAt: iso(0) };
    expect(checkinOpen(e, new Date(start.getTime() + 3.9 * 3600000))).toBe(true);
    expect(checkinOpen(e, new Date(start.getTime() + 4.1 * 3600000))).toBe(false);
  });
  it("makes a six-letter code that changes each 30 seconds and differs per event", () => {
    const t = Date.UTC(2026, 9, 27, 18, 0, 5);
    expect(demoCode("e1", slotAt(t))).toMatch(/^[A-Z]{6}$/);
    expect(demoCode("e1", slotAt(t))).toBe(demoCode("e1", slotAt(t + 10_000)));
    expect(demoCode("e1", slotAt(t))).not.toBe(demoCode("e1", slotAt(t + 30_000)));
    expect(demoCode("e1", slotAt(t))).not.toBe(demoCode("e2", slotAt(t)));
  });
  it("builds the link the QR code carries", () => {
    expect(checkinUrl("e1", "ABCDEF")).toMatch(/\/app\/checkin\/e1\?c=ABCDEF$/);
  });
});

import { buildPods, problemWithPod } from "./clubPods";
describe("pods", () => {
  const pods = [{ id: "p1", org_id: "o", name: "Street", description: "" }, { id: "p2", org_id: "o", name: "Film", description: "" }, { id: "p3", org_id: "o", name: "Portrait", description: "" }];
  const members = [{ pod_id: "p1", user_id: "u1" }, { pod_id: "p1", user_id: "u2" }, { pod_id: "p3", user_id: "u1" }];
  it("lists pods you are in first and says who is in each", () => {
    const list = buildPods(pods, members, [{ id: "c1", pod_id: "p1" }], { u2: "Sam" }, "u1");
    expect(list.map((p) => p.name)).toEqual(["Portrait", "Street", "Film"]);
    expect(list[1]).toMatchObject({ mine: true, channelId: "c1" });
    expect(list[1].members.map((m) => m.name)).toEqual(["Sam", "You"]);
    expect(list[2].mine).toBe(false);
  });
  it("checks a new pod name", () => {
    expect(problemWithPod("  ", [])).toMatch(/name/);
    expect(problemWithPod("***", [])).toMatch(/letters/);
    expect(problemWithPod("film", ["Film"])).toMatch(/already/);
    expect(problemWithPod("Landscape", ["Film"])).toBeNull();
  });
});

import { buildMeetups, problemWithMeetup } from "./clubPods";
describe("pod meetups", () => {
  const now = new Date(2026, 9, 27, 12, 0);
  const at = (h: number) => new Date(now.getTime() + h * 3600000).toISOString();
  const raw = [
    { id: "a", pod_id: "p", title: "Later", details: "", place: "", starts_at: at(48), canceled_at: null, created_by: "u1" },
    { id: "b", pod_id: "p", title: "Sooner", details: "", place: "Quad", starts_at: at(5), canceled_at: null, created_by: "u2" },
    { id: "c", pod_id: "p", title: "Cancelled", details: "", place: "", starts_at: at(6), canceled_at: at(0), created_by: "u2" },
    { id: "d", pod_id: "p", title: "Over", details: "", place: "", starts_at: at(-5), canceled_at: null, created_by: "u2" },
    { id: "e", pod_id: "p", title: "Just started", details: "", place: "", starts_at: at(-2), canceled_at: null, created_by: "u2" },
    { id: "f", pod_id: "other", title: "Elsewhere", details: "", place: "", starts_at: at(3), canceled_at: null, created_by: "u2" },
  ];
  it("shows the pod's meetups that are on or coming, soonest first, with who is in", () => {
    const list = buildMeetups(raw, [{ meetup_id: "b", user_id: "u1" }, { meetup_id: "b", user_id: "u2" }], "p", { u2: "Sam" }, "u1", now);
    expect(list.map((m) => m.title)).toEqual(["Just started", "Sooner", "Later"]);
    expect(list[1]).toMatchObject({ going: true, goingCount: 2, host: "Sam", planned: false });
    expect(list[2]).toMatchObject({ planned: true, host: "You", going: false });
  });
  it("checks a new meetup", () => {
    expect(problemWithMeetup({ title: " ", startsAt: at(2) }, now)).toMatch(/title/);
    expect(problemWithMeetup({ title: "Walk", startsAt: "" }, now)).toMatch(/when/);
    expect(problemWithMeetup({ title: "Walk", startsAt: at(-3) }, now)).toMatch(/passed/);
    expect(problemWithMeetup({ title: "Walk", startsAt: at(3) }, now)).toBeNull();
  });
});
