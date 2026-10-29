import { describe, expect, it } from "vitest";
import { categoryOf, detectMoments, EMPTY_PREFS, headline, scoreOf, type Circle, type MomentEvent, type MomentPrefs } from "./moments";
import type { Person } from "./freeTime";

// Thursday 29 Oct 2026, 9:00 AM
const now = new Date(2026, 9, 29, 9, 0);
const at = (h: number, m = 0, day = 29) => new Date(2026, 9, day, h, m);
const person = (id: string, name: string, busy: [number, number][] = []): Person => ({ id, name, blocks: busy.map(([s, e]) => ({ d: 4, s, e })) });
const me = person("me", "You", [[9 * 60, 12 * 60 + 30]]); // in class until 12:30
const on: MomentPrefs = { ...EMPTY_PREFS, enabled: true };

describe("defaults", () => {
  it("starts off, shown on the feed and folded", () => {
    expect(EMPTY_PREFS).toMatchObject({ enabled: false, showOnFeed: true, collapsed: true });
  });
});
const circle = (members: Person[], over: Partial<Circle> = {}): Circle => ({ id: "c1", name: "Campus Friends", members, unknown: [], total: members.length + 1, ...over });
const ev = (id: string, title: string, start: Date, end: Date, over: Partial<MomentEvent> = {}): MomentEvent => ({ id, title, place: "Student Center", startsAt: start.toISOString(), endsAt: end.toISOString(), status: "published", canceled: false, verified: true, ...over });
const run = (c: Circle[], events: MomentEvent[] = [], prefs = on) => detectMoments({ now, me, circles: c, events, prefs, days: 1 });

describe("what kind of thing an event is", () => {
  it("reads it from the event's own words", () => {
    expect(categoryOf({ title: "Campus Food Festival" })).toBe("food");
    expect(categoryOf({ title: "Calculus review session" })).toBe("study");
    expect(categoryOf({ title: "Intramural soccer" })).toBe("sports");
    expect(categoryOf({ title: "Chess night" })).toBe("gaming");
    expect(categoryOf({ title: "Open mic" })).toBe("creative");
    expect(categoryOf({ title: "Something happens" })).toBe("social");
  });
});

describe("opportunity detection", () => {
  const alex = person("a", "Alex", [[9 * 60, 13 * 60]]);
  const sarah = person("s", "Sarah", [[9 * 60, 12 * 60]]);

  it("does nothing until the student has turned it on", () => {
    expect(run([circle([alex])], [], { ...on, enabled: false })).toEqual([]);
  });
  it("finds the shared window and matches an event inside it", () => {
    const r = run([circle([alex, sarah])], [ev("f", "Campus Food Festival", at(13, 0), at(14, 0))]);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].event?.title).toBe("Campus Food Festival");
    expect(r[0].people.map((p) => p.name).sort()).toEqual(["Alex", "Sarah"]);
    expect(headline(r[0])).toMatch(/3 people in Campus Friends may be free for Campus Food Festival/);
  });
  it("offers a plain opening when nothing is on, but only if it is long enough", () => {
    const long = run([circle([alex])]);
    expect(long[0]?.event).toBeUndefined();
    const tight = person("t", "Tight", [[9 * 60, 12 * 60 + 40], [13 * 60 + 10, 22 * 60]]); // only 30 minutes open together
    expect(run([circle([tight])])).toEqual([]);
  });
  it("needs at least one other person who shares: you alone is not a moment", () => {
    expect(run([circle([])])).toEqual([]);
  });
  it("never counts people who have not shared, and says so", () => {
    const r = run([circle([alex], { unknown: ["Morgan"], total: 3 })], [ev("f", "Food truck", at(13, 0), at(14, 0))]);
    expect(r[0].people.map((p) => p.name)).toEqual(["Alex"]);
    expect(r[0].unknown).toEqual(["Morgan"]);
    expect(r[0].why.join(" ")).toMatch(/1 not sharing/);
  });
  it("skips events that are cancelled, not published or already over", () => {
    const events = [
      ev("1", "Food", at(13, 0), at(14, 0), { canceled: true }),
      ev("2", "Food 2", at(13, 0), at(14, 0), { status: "pending" }),
      ev("3", "Food 3", at(8, 0), at(8, 30)),
    ];
    expect(run([circle([alex])], events).every((m) => !m.event)).toBe(true);
  });
  it("skips an event that is not mostly inside the shared window", () => {
    const r = run([circle([alex])], [ev("late", "Game night", at(12, 45), at(13, 10))]); // only 10 minutes after the window starts
    expect(r.every((m) => m.event?.id !== "late")).toBe(true);
  });
});

describe("student controls come before any score", () => {
  const alex = person("a", "Alex", [[9 * 60, 12 * 60]]);
  const food = ev("f", "Food Festival", at(13, 0), at(14, 0));

  it("kinds the student muted are never suggested", () => {
    expect(run([circle([alex])], [food], { ...on, muted: ["food"] }).some((m) => m.category === "food")).toBe(false);
  });
  it("a hidden circle is never suggested", () => {
    expect(run([circle([alex])], [food], { ...on, hiddenCircles: ["c1"] })).toEqual([]);
  });
  it("a dismissed moment does not come back", () => {
    const first = run([circle([alex])], [food])[0];
    expect(run([circle([alex])], [food], { ...on, dismissed: [first.id] }).some((m) => m.id === first.id)).toBe(false);
  });
  it("rates something that matches your interests higher", () => {
    const likes = run([circle([alex])], [food], { ...on, interests: ["food"] })[0];
    const doesnt = run([circle([alex])], [food], { ...on, interests: ["sports"] })[0];
    expect(likes.score).toBeGreaterThan(doesnt?.score ?? 0);
  });
});

describe("ranking and limits", () => {
  const alex = person("a", "Alex", [[9 * 60, 12 * 60]]);
  it("keeps one suggestion per circle per day, best first", () => {
    const r = detectMoments({ now, me, circles: [circle([alex])], events: [ev("a", "Food", at(13, 0), at(14, 0)), ev("b", "Study group", at(16, 0), at(17, 0))], prefs: on, days: 1 });
    expect(r.filter((m) => m.circleId === "c1")).toHaveLength(1);
  });
  it("applies the weights from the spec", () => {
    expect(scoreOf({ time: 1, group: 1, interest: 1, location: 1, freshness: 1 })).toBeCloseTo(100);
    expect(scoreOf({ time: 1, group: 0, interest: 0, location: 0, freshness: 0 })).toBeCloseTo(30);
    expect(scoreOf({ time: 0, group: 0, interest: 0, location: 0, freshness: 1 })).toBeCloseTo(10);
  });
});
