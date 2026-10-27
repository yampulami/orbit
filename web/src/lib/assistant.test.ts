import { describe, expect, it } from "vitest";
import { answerFor, describeWhen, type AssistantCtx } from "./assistant";
import { cardHeightFor } from "../components/MorphOrb";

const now = new Date(2026, 9, 27, 12, 0); // Tuesday
const at = (days: number, h: number, m = 0) => new Date(2026, 9, 27 + days, h, m).toISOString();
const ctx: AssistantCtx = {
  now,
  events: [
    { title: "Study skills workshop", description: "Time management for midterms", startsAt: at(0, 16), place: "Library, room 2B", host: "University Library", going: 4 },
    { title: "Open build night", description: "Build with us", startsAt: at(1, 19, 30), place: "Engineering lab", host: "Robotics Club", going: 2 },
    { title: "Spring career fair", description: "Over 40 employers", startsAt: at(3, 10), place: "Main gym", host: "Career Services", going: 9 },
  ],
  clubs: [
    { id: "c1", name: "Chess Club", kind: "student", description: "Casual games.", people: 12, mine: false, category: "Gaming and hobbies", meeting: "Thursdays at 6 PM" },
    { id: "c2", name: "Film Society", kind: "student", description: "Weekly screenings.", people: 30, mine: true, category: "Arts and culture", meeting: "" },
  ],
  classes: [{ id: "k1", name: "Physics", days: [3], start: "10:00", end: "11:15", place: "Hall B" }],
  reminders: [{ title: "Lab report", date: "2026-10-30", done: false }, { title: "Old thing", date: "2026-10-20", done: true }],
  unreadMessages: 2, unreadNotifs: 5,
};

describe("describeWhen", () => {
  it("says today, tomorrow or the date", () => {
    expect(describeWhen(at(0, 16), now)).toMatch(/^today at /);
    expect(describeWhen(at(1, 9), now)).toMatch(/^tomorrow at /);
    expect(describeWhen(at(5, 9), now)).toMatch(/ at /);
  });
});

describe("assistant answers", () => {
  it("lists what is on tonight, and only tonight", () => {
    const r = answerFor("what's on tonight?", ctx);
    expect(r.text).toMatch(/1 event tonight/);
    expect(r.text).toMatch(/Study skills workshop/);
    expect(r.text).not.toMatch(/Open build night/);
  });
  it("answers about tomorrow and the week, and says so when nothing is on", () => {
    expect(answerFor("anything tomorrow", ctx).text).toMatch(/Open build night/);
    expect(answerFor("events this week", ctx).text).toMatch(/3 events this week/);
    expect(answerFor("events this weekend", { ...ctx, events: [] }).text).toMatch(/do not see any/);
  });
  it("finds an event by a word in it", () => {
    expect(answerFor("is there a career fair", ctx).text).toMatch(/Spring career fair/);
  });
  it("describes a club by name and opens its page", () => {
    const r = answerFor("when does chess club meet", ctx);
    expect(r.text).toMatch(/Chess Club is a student club with 12 people/);
    expect(r.text).toMatch(/Thursdays at 6 PM/);
    expect(r.go).toBe("/app/campus/clubs/c1");
  });
  it("knows my clubs", () => {
    expect(answerFor("which clubs am I in? my clubs", ctx).text).toMatch(/Film Society/);
  });
  it("gives the next class, reminders and unread counts", () => {
    expect(answerFor("when is my next class", ctx).text).toMatch(/Physics on Wednesday at 10:00 AM in Hall B/);
    expect(answerFor("what are my reminders", ctx).text).toMatch(/1 open reminder: Lab report/);
    expect(answerFor("any unread messages?", ctx).text).toMatch(/2 unread messages and 5 unread notifications/);
  });
  it("opens pages", () => {
    expect(answerFor("open messages", ctx).go).toBe("/app/messages");
    expect(answerFor("take me to the map", ctx).go).toBe("/app/map");
    expect(answerFor("go to campus", ctx).go).toBe("/app/campus");
  });
  it("explains how things work and falls back politely", () => {
    expect(answerFor("how do I check in to an event", ctx).text).toMatch(/30 seconds/);
    expect(answerFor("how do I start a club", ctx).text).toMatch(/Start a club/);
    expect(answerFor("asdf qwer", ctx).text).toMatch(/not sure/);
    expect(answerFor("hello", ctx).text).toMatch(/^Hi!/);
  });
});

describe("answer card height", () => {
  it("grows with the answer and stays within its limits", () => {
    expect(cardHeightFor("Short.", 360)).toBe(108);
    expect(cardHeightFor("x".repeat(260), 360)).toBeGreaterThan(108);
    expect(cardHeightFor("x".repeat(5000), 360)).toBe(340);
  });
});
