import { describe, expect, it } from "vitest";
import { toPin, toReminder, toReminderRow, type ReminderRow } from "./privateDb";

const row: ReminderRow = { id: "r1", user_id: "u1", title: "Submit CS lab", remind_on: "2026-10-22", remind_at: "15:00:00", done: false, notified: true };

describe("reminder rows", () => {
  it("turns a database row into a reminder, trimming the time to hours and minutes", () => {
    expect(toReminder(row)).toEqual({ id: "r1", title: "Submit CS lab", date: "2026-10-22", time: "15:00", done: false, notified: true });
  });
  it("keeps a reminder with no time as having no time", () => {
    expect(toReminder({ ...row, remind_at: null }).time).toBeUndefined();
  });
  it("round-trips without losing anything", () => {
    expect(toReminderRow("u1", toReminder(row))).toEqual({ ...row, remind_at: "15:00" });
  });
  it("sends no time as null and a missing notified flag as false", () => {
    const r = toReminderRow("u1", { id: "r2", title: "Call mom", date: "2026-10-23", done: false });
    expect(r.remind_at).toBeNull();
    expect(r.notified).toBe(false);
    expect(r.user_id).toBe("u1");
  });
});

describe("pin rows", () => {
  it("maps item_id to id", () => {
    expect(toPin({ kind: "hangout", item_id: "h1" })).toEqual({ kind: "hangout", id: "h1" });
  });
});
