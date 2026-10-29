import { describe, expect, it } from "vitest";
import { parseIcs } from "./icsImport";

const wrap = (...events: string[]) => ["BEGIN:VCALENDAR", "VERSION:2.0", ...events.flatMap((e) => ["BEGIN:VEVENT", e, "END:VEVENT"]), "END:VCALENDAR"].join("\r\n");

describe("calendar import", () => {
  it("turns a weekly event into a class", () => {
    const r = parseIcs(wrap(["SUMMARY:Physics 101", "DTSTART;TZID=America/New_York:20261026T113000", "DTEND;TZID=America/New_York:20261026T124500", "RRULE:FREQ=WEEKLY;BYDAY=MO,WE", "LOCATION:ALB 302"].join("\r\n")));
    expect(r.classes).toEqual([{ name: "Physics 101", days: [1, 3], start: "11:30", end: "12:45", place: "ALB 302" }]);
    expect(r.skipped).toBe(0);
  });
  it("uses the weekday of the first date when there is no BYDAY", () => {
    const r = parseIcs(wrap(["SUMMARY:Lab", "DTSTART:20261028T130000", "DTEND:20261028T153000", "RRULE:FREQ=WEEKLY"].join("\r\n")));
    expect(r.classes[0].days).toEqual([3]);
  });
  it("skips one-off events and counts them", () => {
    const r = parseIcs(wrap(["SUMMARY:Dentist", "DTSTART:20261028T130000", "DTEND:20261028T140000"].join("\r\n"), ["SUMMARY:Daily thing", "DTSTART:20261028T090000", "DTEND:20261028T093000", "RRULE:FREQ=DAILY"].join("\r\n")));
    expect(r.classes).toEqual([]);
    expect(r.skipped).toBe(2);
  });
  it("joins the same class listed once per weekday, and unfolds long lines and escapes", () => {
    const mon = ["SUMMARY:Art\, Modern", "DTSTART:20261026T100000", "DTEND:20261026T111500", "RRULE:FREQ=WEEKLY;BYDAY=MO"].join("\r\n");
    const wed = ["SUMMARY:Art\, Mod", " ern", "DTSTART:20261028T100000", "DTEND:20261028T111500", "RRULE:FREQ=WEEKLY;BYDAY=WE"].join("\r\n");
    const r = parseIcs(wrap(mon, wed));
    expect(r.classes).toHaveLength(1);
    expect(r.classes[0]).toMatchObject({ name: "Art, Modern", days: [1, 3] });
  });
  it("ignores events that end before they start or have no name", () => {
    const r = parseIcs(wrap(["SUMMARY:Bad", "DTSTART:20261026T120000", "DTEND:20261026T110000", "RRULE:FREQ=WEEKLY;BYDAY=MO"].join("\r\n"), ["DTSTART:20261026T100000", "DTEND:20261026T110000", "RRULE:FREQ=WEEKLY;BYDAY=MO"].join("\r\n")));
    expect(r.classes).toEqual([]);
    expect(r.skipped).toBe(2);
  });
  it("is empty for text that is not a calendar", () => {
    expect(parseIcs("hello")).toEqual({ classes: [], skipped: 0 });
  });
});
