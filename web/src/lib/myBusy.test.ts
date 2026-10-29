import { describe, expect, it } from "vitest";
import { buildMyBusy, busyOn, type BusyInput } from "./myBusy";
import { commonFree, freeNow } from "./freeTime";

const at = (h: number, m = 0, day = 28) => new Date(2026, 9, day, h, m); // Wednesday
const base: BusyInput = { classes: [], hangouts: [], events: [], reminders: [] };
const names = (i: BusyInput, d = at(9)) => busyOn(i, d).map((x) => x.label);

describe("what counts as busy", () => {
  it("counts classes on their weekdays only", () => {
    const i = { ...base, classes: [{ id: "1", name: "Physics", days: [3], start: "11:30", end: "12:45" }, { id: "2", name: "Art", days: [4], start: "09:00", end: "10:00" }] };
    expect(names(i)).toEqual(["Physics"]);
  });
  it("counts hangouts unless turned down, cancelled or not yours", () => {
    const h = (title: string, extra = {}) => ({ title, when: at(18).toISOString(), ...extra });
    const i = { ...base, hangouts: [h("Coffee"), h("Skipped", { rsvp: "no" as const }), h("Called off", { canceled: true }), h("Other group", { visible: false }), h("Said yes", { rsvp: "yes" as const })] };
    expect(names(i)).toEqual(["Coffee", "Said yes"]);
  });
  it("counts events going to, interested in and hosting, but not ones you ignored or that were cancelled", () => {
    const e = (title: string, extra = {}) => ({ title, startsAt: at(15).toISOString(), status: "published", ...extra });
    const i = { ...base, events: [e("Going", { mine: "going" }), e("Maybe", { mine: "interested" }), e("Mine", { mineHost: true }), e("Nothing"), e("Cancelled", { mine: "going", canceled: true })] };
    expect(names(i)).toEqual(["Going", "Maybe", "Mine"]);
  });
  it("counts reminders that have a time and are not done, for half an hour", () => {
    const i = { ...base, reminders: [{ title: "Call mom", date: "2026-10-28", time: "17:00", done: false }, { title: "No time", date: "2026-10-28", done: false }, { title: "Done", date: "2026-10-28", time: "18:00", done: true }] };
    const [only] = busyOn(i, at(9));
    expect(names(i)).toEqual(["Call mom"]);
    expect(only.end.getTime() - only.start.getTime()).toBe(30 * 60000);
  });
});

describe("free time from everything", () => {
  const i: BusyInput = {
    classes: [{ id: "1", name: "Physics", days: [3], start: "11:30", end: "12:45" }],
    hangouts: [],
    events: [{ title: "Career fair", startsAt: at(14).toISOString(), endsAt: at(16).toISOString(), status: "published", mine: "interested" }],
    reminders: [],
  };
  it("is not free during a class or an event you are interested in", () => {
    const me = buildMyBusy(i, at(8));
    expect(freeNow(me, at(12))).toBeNull();
    expect(freeNow(me, at(15))).toBeNull();
    expect(freeNow(me, at(13))!.minutes).toBe(60); // 12:45 is class end, event at 14:00
  });
  it("leaves the gaps between them as common free time", () => {
    const w = commonFree([buildMyBusy(i, at(8))], at(8), { days: 1, min: 60 });
    expect(w.map((x) => [x.start.getHours() * 60 + x.start.getMinutes(), x.end.getHours() * 60 + x.end.getMinutes()])).toEqual([[480, 690], [765, 840], [960, 1320]]);
  });
});
