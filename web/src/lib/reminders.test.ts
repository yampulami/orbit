import { describe, expect, it } from "vitest";
import { dueAt, dueNow, inMinutes, type Reminder } from "./reminders";

const NOW = new Date(2026, 9, 21, 12, 0);
const r = (id: string, date: string, extra: Partial<Reminder> = {}): Reminder => ({ id, title: id, date, done: false, ...extra });

describe("dueAt", () => {
  it("uses the time you picked", () => {
    expect(dueAt(r("a", "2026-10-21", { time: "15:30" })).getTime()).toBe(new Date(2026, 9, 21, 15, 30).getTime());
  });

  it("alerts at 9:00 in the morning when there is no time", () => {
    expect(dueAt(r("a", "2026-10-21")).getTime()).toBe(new Date(2026, 9, 21, 9, 0).getTime());
  });
});

describe("dueNow", () => {
  it("returns reminders whose time has come", () => {
    const list = [r("past", "2026-10-21", { time: "11:00" }), r("exact", "2026-10-21", { time: "12:00" }), r("later", "2026-10-21", { time: "12:01" }), r("tomorrow", "2026-10-22")];
    expect(dueNow(list, NOW).map((x) => x.id)).toEqual(["past", "exact"]);
  });

  it("skips done and already-alerted reminders", () => {
    const list = [r("done", "2026-10-20", { done: true }), r("shown", "2026-10-20", { notified: true }), r("fresh", "2026-10-20")];
    expect(dueNow(list, NOW).map((x) => x.id)).toEqual(["fresh"]);
  });
});

describe("inMinutes", () => {
  it("gives a stored date and time", () => {
    expect(inMinutes(NOW, 10)).toEqual({ date: "2026-10-21", time: "12:10" });
  });

  it("rolls over midnight", () => {
    expect(inMinutes(new Date(2026, 9, 21, 23, 55), 10)).toEqual({ date: "2026-10-22", time: "00:05" });
  });
});
