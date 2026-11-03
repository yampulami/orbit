import { describe, expect, it } from "vitest";
import { inferYear, parseDay, parseEventPage, parseIcs, parseTimes, planSync, problemWithSourceUrl, readSource, unwrapLink, zonedToUtc, type StoredEvent } from "../../../supabase/functions/_shared/eventSources";

const NOW = new Date("2026-11-03T15:00:00Z");
const p = (style: string, text: string) => `<p dir="ltr" class="x"><span style="${style}">${text}</span></p>`;
const block = (title: string, date: string, time: string, loc: string, details: string) =>
  p("color: #c8102e; font-weight: 700;", title) + p("", `<b>Date :</b> ${date}`) + p("", `Time: ${time}`) + p("", `Location: ${loc}`) + p("", `Details: ${details}`);
const PAGE = `<html><script>var x = "Date : nothing";</script><body>${[
  block("Study Skills", "Wednesday, November 4", "11:30 PM - 1:30 PM", "Library", 'Bring a laptop. <a href="https://www.google.com/url?q=https%3A%2F%2Fforms.example.com%2Fgo&amp;sa=D">Sign up</a>'),
  block("Rep Your Roots!", "Thursday, November 5", "All day", "", "Wear something from home."),
  block("Bowling Night", "Monday, November 2", "5:00 PM - 7:00 PM", "CANCELLED", "Transportation provided."),
  block("Fall Fair", "Friday, November 6", "1:00 PM", "Quad", "Games and food.") + "<p>Report abuse Page details Page updated</p>",
].join("")}</body></html>`;

describe("times", () => {
  it("reads ranges, single times and all day", () => {
    expect(parseTimes("5:00 PM - 7:00 PM")).toEqual({ start: { h: 17, m: 0 }, end: { h: 19, m: 0 } });
    expect(parseTimes("10 AM – 2 PM")).toEqual({ start: { h: 10, m: 0 }, end: { h: 14, m: 0 } });
    expect(parseTimes("1:00 PM")).toEqual({ start: { h: 13, m: 0 } });
    expect(parseTimes("All day")).toBe("allday");
    expect(parseTimes("TBD")).toBeNull();
  });
  it("mends a start typed as the evening", () => {
    expect(parseTimes("11:30 PM - 1:30 PM")).toEqual({ start: { h: 11, m: 30 }, end: { h: 13, m: 30 } });
    expect(parseTimes("12 - 2 PM")).toEqual({ start: { h: 12, m: 0 }, end: { h: 14, m: 0 } });
    expect(parseTimes("10 - 2 PM")).toEqual({ start: { h: 10, m: 0 }, end: { h: 14, m: 0 } });
  });
});

describe("days and years", () => {
  it("reads a day", () => {
    expect(parseDay("Monday, November 2")).toEqual({ month: 11, day: 2, year: undefined });
    expect(parseDay("Nov 5th, 2027")).toEqual({ month: 11, day: 5, year: 2027 });
    expect(parseDay("11/9")).toEqual({ month: 11, day: 9, year: undefined });
    expect(parseDay("soon")).toBeNull();
  });
  it("picks the coming year for a date with none", () => {
    expect(inferYear(11, 2, NOW)).toBe(2026);
    expect(inferYear(1, 20, NOW)).toBe(2027);
    expect(inferYear(10, 1, NOW)).toBe(2026); // a month ago still counts as this year
    expect(inferYear(8, 1, NOW)).toBe(2027);
  });
  it("knows the clock change", () => {
    expect(zonedToUtc(2026, 11, 2, 17, 0).toISOString()).toBe("2026-11-02T22:00:00.000Z");
    expect(zonedToUtc(2026, 7, 4, 17, 0).toISOString()).toBe("2026-07-04T21:00:00.000Z");
  });
});

describe("a hand-written page", () => {
  const ev = parseEventPage(PAGE, NOW, "America/New_York", "https://site.test/events");
  it("finds every block and ignores script text", () => {
    expect(ev.map((e) => e.title)).toEqual(["Study Skills", "Rep Your Roots!", "Bowling Night", "Fall Fair"]);
  });
  it("reads times, mending the typo", () => {
    expect(ev[0].startsAt).toBe("2026-11-04T16:30:00.000Z");
    expect(ev[0].endsAt).toBe("2026-11-04T18:30:00.000Z");
  });
  it("keeps a registration link as its real address", () => { expect(ev[0].description).toContain("https://forms.example.com/go"); });
  it("handles all day, cancelled and a single time", () => {
    expect(ev[1].allDay).toBe(true);
    expect(ev[1].description.startsWith("All day.")).toBe(true);
    expect(ev[2].canceled).toBe(true);
    expect(ev[2].place).toBe("");
    expect(ev[3].endsAt).toBeUndefined();
    expect(ev[3].description).not.toMatch(/report abuse/i);
  });
  it("links back to the page", () => { expect(ev[3].description).toContain("More at https://site.test/events"); });
  it("keeps the same key when only the time changes", () => {
    const moved = parseEventPage(PAGE.replace("11:30 PM - 1:30 PM", "2:00 PM - 3:00 PM"), NOW);
    expect(moved[0].key).toBe(ev[0].key);
  });
  it("finds nothing on a page with no events", () => { expect(parseEventPage("<html><body><p>Welcome</p></body></html>", NOW)).toEqual([]); });
});

describe("a calendar feed", () => {
  const ICS = [
    "BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:abc-1@club", "SUMMARY:Open mic\\, live", "DTSTART;TZID=America/New_York:20261105T190000", "DTEND;TZID=America/New_York:20261105T210000",
    "LOCATION:Student Center", "DESCRIPTION:Sign up at the door.", " Free snacks.", "END:VEVENT",
    "BEGIN:VEVENT", "UID:abc-2@club", "SUMMARY:Bake sale", "DTSTART;VALUE=DATE:20261106", "DTEND;VALUE=DATE:20261107", "STATUS:CANCELLED", "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const ev = parseIcs(ICS);
  it("reads events", () => {
    expect(ev).toHaveLength(2);
    expect(ev[0]).toMatchObject({ key: "uid:abc-1@club", title: "Open mic, live", startsAt: "2026-11-06T00:00:00.000Z", endsAt: "2026-11-06T02:00:00.000Z", place: "Student Center" });
    expect(ev[0].description).toBe("Sign up at the door.Free snacks.");
  });
  it("reads all-day and cancelled", () => { expect(ev[1]).toMatchObject({ allDay: true, canceled: true }); });
  it("chooses the reader from the content", () => {
    expect(readSource(ICS, "text/plain", NOW)).toHaveLength(2);
    expect(readSource(PAGE, "text/html", NOW)).toHaveLength(4);
  });
});

describe("addresses", () => {
  it("accepts public https addresses only", () => {
    expect(problemWithSourceUrl("https://sites.google.com/caldwell.edu/cougar39/event-calendar")).toBeNull();
    expect(problemWithSourceUrl("http://club.edu/events")).toMatch(/https/);
    expect(problemWithSourceUrl("https://localhost/x")).not.toBeNull();
    expect(problemWithSourceUrl("https://10.0.0.5/x")).not.toBeNull();
    expect(problemWithSourceUrl("https://a:b@club.edu/x")).not.toBeNull();
    expect(problemWithSourceUrl("not a url")).not.toBeNull();
  });
  it("unwraps google links", () => { expect(unwrapLink("https://www.google.com/url?q=https%3A%2F%2Fa.test%2Fb&sa=D")).toBe("https://a.test/b"); });
});

describe("deciding what to change", () => {
  const found = parseEventPage(PAGE, NOW);
  const stored = (e: (typeof found)[number], extra: Partial<StoredEvent> = {}): StoredEvent => ({ id: `id-${e.key}`, external_key: e.key, title: e.title, description: e.description, place_name: e.place, starts_at: e.startsAt, ends_at: e.endsAt ?? null, canceled_at: null, status: "published", ...extra });
  it("adds new events, skipping ones long over", () => {
    const plan = planSync(found, [], NOW);
    expect(plan.add.map((e) => e.title)).toEqual(["Study Skills", "Rep Your Roots!", "Bowling Night", "Fall Fair"]);
    expect(planSync(found, [], new Date("2027-02-01T00:00:00Z")).add).toEqual([]);
  });
  it("cancels what the page now marks cancelled, and changes nothing else", () => {
    expect(planSync(found, found.map((e) => stored(e)), NOW)).toEqual({ add: [], change: [], cancel: ["id-" + found[2].key], hide: [], restore: [] });
  });
  it("updates edited events", () => {
    const old = found.map((e) => stored(e, e.title === "Study Skills" ? { place_name: "Old room" } : {}));
    expect(planSync(found, old, NOW).change.map((c) => c.id)).toEqual(["id-" + found[0].key]);
  });
  it("hides an event taken off the page, and brings it back", () => {
    const gone = stored({ ...found[3], key: "gone", title: "Gone" });
    expect(planSync(found, [...found.map((e) => stored(e)), gone], NOW).hide).toEqual([gone.id]);
    expect(planSync(found, found.map((e) => stored(e, e.title === "Fall Fair" ? { status: "removed" } : {})), NOW).restore).toEqual(["id-" + found[3].key]);
  });
  it("hides nothing when the page listed nothing", () => {
    expect(planSync([], found.map((e) => stored(e)), NOW).hide).toEqual([]);
  });
});
