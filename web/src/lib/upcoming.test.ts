import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { YOU, type Group, type Hangout } from "./hangouts";
import type { Reminder } from "./reminders";
import type { Task } from "./roommates";
import { buildUpcoming } from "./upcoming";

// Wednesday 21 Oct 2026, 12:00 local.
const NOW = new Date(2026, 9, 21, 12);
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => vi.useRealTimers());

const at = (days: number, hour = 12) => new Date(2026, 9, 21 + days, hour).toISOString();
const ymd = (days: number) => { const d = new Date(2026, 9, 21 + days); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

const groups: Group[] = [{ id: "g", name: "Crew", members: [YOU, "Maya"], messages: [] }];
const hangout = (id: string, when: string, rsvps: Hangout["rsvps"] = {}, extra: Partial<Hangout> = {}): Hangout => ({ id, groupId: "g", title: id, place: "Cafe", when, by: "Maya", rsvps, ...extra });
const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, assignee: YOU, points: 2, done: false, createdAt: at(-1), ...extra });
const reminder = (id: string, date: string, extra: Partial<Reminder> = {}): Reminder => ({ id, title: id, date, done: false, ...extra });
const run = (o: Partial<Parameters<typeof buildUpcoming>[0]>) => buildUpcoming({ now: NOW, groups, hangouts: [], tasks: [], reminders: [], ...o });

describe("buildUpcoming: hangouts", () => {
  it("asks for an answer when you have not replied", () => {
    expect(run({ hangouts: [hangout("a", at(2))] })[0].tag).toBe("answer");
  });

  it("does not nag once you have answered, and marks today and soon", () => {
    expect(run({ hangouts: [hangout("a", at(2), { [YOU]: "yes" })] })[0].tag).toBeUndefined();
    expect(run({ hangouts: [hangout("a", at(0, 18), { [YOU]: "yes" })] })[0].tag).toBe("today");
    expect(run({ hangouts: [hangout("a", at(0, 14), { [YOU]: "yes" })] })[0].tag).toBe("soon");
    expect(run({ hangouts: [hangout("a", at(1, 10), { [YOU]: "yes" })] })[0].tag).toBe("tomorrow");
  });

  it("skips canceled hangouts, unknown groups, old ones and ones far away", () => {
    const hs = [hangout("canceled", at(1), {}, { canceled: true }), hangout("nogroup", at(1), {}, { groupId: "zzz" }), hangout("old", at(-2)), hangout("far", at(45))];
    expect(run({ hangouts: hs })).toEqual([]);
  });
});

describe("buildUpcoming: chores", () => {
  it("only shows your open chores", () => {
    const items = run({ tasks: [task("mine"), task("theirs", { assignee: "Maya" }), task("done", { done: true })] });
    expect(items.map((i) => i.title)).toEqual(["mine"]);
  });

  it("flags overdue and due-today chores, and sorts undated ones last", () => {
    const items = run({ tasks: [task("undated"), task("late", { due: ymd(-1) }), task("today", { due: ymd(0) }), task("later", { due: ymd(3) })] });
    expect(items.map((i) => i.title)).toEqual(["late", "today", "later", "undated"]);
    expect(items[0].tag).toBe("overdue");
    expect(items[1].tag).toBe("today");
    expect(items[2].tag).toBeUndefined();
    expect(items[0].sub).toMatch(/^Was due/);
  });
});

describe("buildUpcoming: reminders", () => {
  it("shows upcoming reminders and hides done ones", () => {
    const items = run({ reminders: [reminder("soon", ymd(2)), reminder("done", ymd(2), { done: true })] });
    expect(items.map((i) => i.title)).toEqual(["soon"]);
    expect(items[0].reminderId).toBe("soon");
  });

  it("keeps a recent missed reminder as overdue but drops one from weeks ago", () => {
    const items = run({ reminders: [reminder("missed", ymd(-2)), reminder("ancient", ymd(-20))] });
    expect(items.map((i) => i.title)).toEqual(["missed"]);
    expect(items[0].tag).toBe("overdue");
  });

  it("uses the time of day when there is one", () => {
    const items = run({ reminders: [reminder("later", ymd(0), { time: "18:30" }), reminder("earlier", ymd(0), { time: "13:00" })] });
    expect(items.map((i) => i.title)).toEqual(["earlier", "later"]);
    expect(items[0].tag).toBe("today");
  });
});

describe("buildUpcoming: ordering", () => {
  it("merges everything soonest first, overdue at the top", () => {
    const items = run({
      hangouts: [hangout("hang", at(2), { [YOU]: "yes" })],
      tasks: [task("late", { due: ymd(-1) }), task("undated")],
      reminders: [reminder("rem", ymd(1), { time: "09:00" })],
    });
    expect(items.map((i) => i.title)).toEqual(["late", "rem", "hang", "undated"]);
  });

  it("can limit the list", () => {
    expect(run({ reminders: [reminder("a", ymd(1)), reminder("b", ymd(2)), reminder("c", ymd(3))], limit: 2 })).toHaveLength(2);
  });
});
