import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { earnedIds, streakWeeks, type EventType } from "./progress";

// Wednesday 21 Oct 2026, local noon. Weeks run Monday to Sunday.
const NOW = new Date(2026, 9, 21, 12, 0, 0);
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();
const ev = (type: EventType, n = 0) => ({ type, at: daysAgo(n) });

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => vi.useRealTimers());

describe("streakWeeks", () => {
  it("is 0 with no activity", () => {
    expect(streakWeeks({ events: [] })).toBe(0);
  });

  it("counts this week", () => {
    expect(streakWeeks({ events: [ev("post")] })).toBe(1);
  });

  it("counts consecutive weeks", () => {
    expect(streakWeeks({ events: [ev("post"), ev("reply", 7), ev("plan", 14)] })).toBe(3);
  });

  it("does not break just because this week has no activity yet", () => {
    expect(streakWeeks({ events: [ev("post", 7), ev("post", 14)] })).toBe(2);
  });

  it("resets after a fully missed week", () => {
    expect(streakWeeks({ events: [ev("post", 14), ev("post", 21)] })).toBe(0);
    expect(streakWeeks({ events: [ev("post"), ev("post", 14)] })).toBe(1);
  });

  it("counts several events in one week once", () => {
    expect(streakWeeks({ events: [ev("post"), ev("reply"), ev("plan", 1)] })).toBe(1);
  });

  it("puts Sunday and the next Monday in different weeks", () => {
    // Mon 19 Oct is two days ago, Sun 18 Oct is three days ago: two separate weeks.
    expect(streakWeeks({ events: [ev("post", 2), ev("post", 3)] })).toBe(2);
  });
});

describe("earnedIds", () => {
  it("earns nothing at the start", () => {
    expect(earnedIds({ events: [] })).toEqual([]);
  });

  it("earns First post, First hangout and Group starter on first use", () => {
    expect(earnedIds({ events: [ev("post"), ev("plan"), ev("group")] })).toEqual(["first-post", "group-starter", "first-hangout"]);
  });

  it("needs ten replies for Conversation starter", () => {
    const nine = Array.from({ length: 9 }, () => ev("reply"));
    expect(earnedIds({ events: nine })).not.toContain("chatty");
    expect(earnedIds({ events: [...nine, ev("reply")] })).toContain("chatty");
  });

  it("needs five Yes answers for Say yes and three check-ins for Regular", () => {
    expect(earnedIds({ events: Array.from({ length: 4 }, () => ev("rsvpYes")) })).not.toContain("say-yes");
    expect(earnedIds({ events: Array.from({ length: 5 }, () => ev("rsvpYes")) })).toContain("say-yes");
    expect(earnedIds({ events: Array.from({ length: 2 }, () => ev("checkin")) })).not.toContain("regular");
    expect(earnedIds({ events: Array.from({ length: 3 }, () => ev("checkin")) })).toContain("regular");
  });

  it("earns Rainy day only when a check-in and a No share a week", () => {
    expect(earnedIds({ events: [ev("checkin"), ev("rsvpNo")] })).toContain("rainy-day");
    expect(earnedIds({ events: [ev("checkin"), ev("rsvpNo", 8)] })).not.toContain("rainy-day");
  });
});
