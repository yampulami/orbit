// Reads a club's or office's own events page into Orbit events. Pure functions only (no network, no database), so the same file is
// run by the sync function on the server and by the tests in web/. Two kinds of page are understood:
//   1. a calendar feed (an .ics file / "public address in iCal format"), the dependable way
//   2. a hand-written page where each event is a block of "Title / Date: / Time: / Location: / Details:" (the Caldwell "The 39" page)

export type SourceEvent = {
  /** Stays the same when the time or place is edited, so a later sync updates the event instead of adding a second one. */
  key: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  allDay: boolean;
  place: string;
  description: string;
  canceled: boolean;
};

const DEFAULT_ZONE = "America/New_York";

/* ---------- time ---------- */

/** The UTC moment at which a wall clock reads this time in this zone (handles daylight saving). */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, zone = DEFAULT_ZONE): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const offset = (t: number) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" })
      .formatToParts(new Date(t)).reduce<Record<string, number>>((a, p) => { if (p.type !== "literal") a[p.type] = Number(p.value); return a; }, {});
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - t;
  };
  let t = guess - offset(guess);
  t = guess - offset(t); // the offset at the corrected moment (matters right at a clock change)
  return new Date(t);
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const monthOf = (word: string) => MONTHS.findIndex((m) => m === word.toLowerCase() || m.slice(0, 3) === word.toLowerCase().slice(0, 3)) + 1;

/** "Monday, November 2" (or "Nov 2, 2026", "11/2") into a month and day, and the year when it is written. */
export function parseDay(text: string): { month: number; day: number; year?: number } | null {
  const named = text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(20\d{2}))?/i);
  if (named) return { month: monthOf(named[1]), day: Number(named[2]), year: named[3] ? Number(named[3]) : undefined };
  const num = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (num) { const y = num[3] ? Number(num[3]) : undefined; return { month: Number(num[1]), day: Number(num[2]), year: y === undefined ? undefined : y < 100 ? 2000 + y : y }; }
  return null;
}

/** A date written without a year means its next coming (a date from the last couple of months still counts as this year). */
export function inferYear(month: number, day: number, now: Date): number {
  const y = now.getUTCFullYear();
  const at = (year: number) => Date.UTC(year, month - 1, day, 12);
  const DAY = 86400000;
  if (at(y) < now.getTime() - 60 * DAY) return y + 1;
  if (at(y) > now.getTime() + 305 * DAY) return y - 1;
  return y;
}

type Clock = { h: number; m: number };

/** "5:00 PM - 7:00 PM" into start and end. Mends the usual typos: "11:30 PM - 1:30 PM" (the start was meant as the morning), "12 - 2 PM". */
export function parseTimes(text: string): { start: Clock; end?: Clock } | "allday" | null {
  const t = text.replace(/[–—]/g, "-").replace(/\./g, "").trim();
  if (!t || /all[\s-]*day/i.test(t)) return /all[\s-]*day/i.test(t) ? "allday" : null;
  if (/^(tbd|tba|to be (announced|determined))/i.test(t)) return null;
  const one = "(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm|noon)?";
  const range = t.match(new RegExp(`${one}\\s*(?:-|to|until)\\s*${one}`, "i"));
  const mk = (h: string, m: string | undefined, ap: string | undefined, hint?: string): { clock: Clock; ap?: string } => {
    let hour = Number(h);
    const meridiem = (ap ?? hint)?.toLowerCase();
    if (meridiem === "noon") return { clock: { h: 12, m: Number(m ?? 0) }, ap: "pm" };
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    return { clock: { h: hour, m: Number(m ?? 0) }, ap: meridiem };
  };
  if (range) {
    const e = mk(range[4], range[5], range[6]);
    let s = mk(range[1], range[2], range[3], range[3] ? undefined : range[6]);
    // "12 - 2 PM" or "10 - 2 PM": a start with no AM/PM takes the end's, unless that would put it after the end.
    if (!range[3] && s.clock.h * 60 + s.clock.m > e.clock.h * 60 + e.clock.m && range[6]) s = mk(range[1], range[2], range[6].toLowerCase() === "pm" ? "am" : "pm");
    // "11:30 PM - 1:30 PM": starts after it ends, so the start was meant as the morning.
    else if (range[3]?.toLowerCase() === "pm" && range[6]?.toLowerCase() === "pm" && s.clock.h * 60 + s.clock.m > e.clock.h * 60 + e.clock.m) s = mk(range[1], range[2], "am");
    return { start: s.clock, end: e.clock };
  }
  const single = t.match(new RegExp(one, "i"));
  if (single && (single[3] || single[2] || /\d/.test(single[1]))) return { start: mk(single[1], single[2], single[3]).clock };
  return null;
}

/* ---------- text helpers ---------- */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", hellip: "…" };
export const decodeEntities = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") { const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1)); try { return String.fromCodePoint(code); } catch { return ""; } }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

/** Google wraps outgoing links as google.com/url?q=THE-REAL-ADDRESS; give back the real one. */
export function unwrapLink(href: string): string {
  try {
    const u = new URL(decodeEntities(href), "https://example.invalid");
    if (/(^|\.)google\.com$/.test(u.hostname) && u.pathname === "/url") return u.searchParams.get("q") ?? u.searchParams.get("url") ?? href;
    return u.hostname === "example.invalid" ? href : u.toString();
  } catch { return href; }
}

const MARK = "\u0001"; // put in front of a paragraph written in the page's heading colour

/** A page's HTML into plain lines, one per paragraph. Links keep their address, and heading-coloured paragraphs are marked. */
export function pageLines(html: string): string[] {
  let s = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, "");
  s = s.replace(/<a\b[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, "").trim();
    const real = unwrapLink(href);
    return /^https?:/i.test(real) && !text.includes(real) && !/^https?:/i.test(text) ? `${inner} (${real})` : inner;
  });
  s = s.replace(/<p\b[^>]*>/gi, (tag) => `\n${/color:\s*#c8102e/i.test(tag) ? MARK : ""}`);
  // Google Sites puts the heading colour on the span inside the paragraph, so look ahead per paragraph.
  s = s.replace(/\n(<span[^>]*color:\s*#c8102e)/gi, `\n${MARK}$1`);
  s = s.replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/h[1-6]>|<\/tr>/gi, "\n").replace(/<[^>]+>/g, "");
  return decodeEntities(s).split(/\n+/).map((l) => l.replace(/[ \s]+/g, " ").trim()).filter(Boolean);
}

const FIELD = /^(date|time|location|where|details?|description|when|place|rsvp|register|registration)\s*:/i;
const shortHash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const normalTitle = (t: string) => t.toLowerCase().replace(/\bcancell?ed\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const CANCEL = /\bcancell?ed\b/i;
const keyFor = (title: string, y: number, mo: number, d: number) => `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}:${shortHash(normalTitle(title))}`;

/* ---------- 1. a hand-written page ---------- */

/** Events written as blocks of Title, Date:, Time:, Location:, Details:. */
export function parseEventPage(html: string, now = new Date(), zone = DEFAULT_ZONE, sourceUrl = ""): SourceEvent[] {
  const lines = pageLines(html);
  const out: SourceEvent[] = [];
  const dateAt = lines.flatMap((l, i) => (/^\u0001?\s*date\s*:/i.test(l) ? [i] : []));
  dateAt.forEach((at, n) => {
    const stop = dateAt[n + 1] ?? lines.length;
    // The title is the line just above the date. (A line above that is a field means this event has no title.)
    const above = lines[at - 1]?.replace(MARK, "").trim() ?? "";
    if (!above || FIELD.test(above)) return;
    const title = above;
    // The next event's title is the last line before its date, so it is not part of these details; the last event also ends where the page's footer begins.
    const footer = lines.findIndex((l, i) => i > at && /^(report abuse|page details|page updated)/i.test(l));
    const end = Math.min(n + 1 < dateAt.length ? stop - 1 : lines.length, footer < 0 ? lines.length : footer);
    const body = lines.slice(at, Math.max(at + 1, end)).map((l) => l.replace(MARK, ""));
    const get = (name: RegExp) => {
      const i = body.findIndex((l) => name.test(l));
      if (i < 0) return "";
      const first = body[i].replace(name, "").trim();
      const rest: string[] = [];
      for (let j = i + 1; j < body.length && !FIELD.test(body[j]); j++) rest.push(body[j]);
      return [first, ...rest].join(" ").replace(/\s+/g, " ").trim();
    };
    const day = parseDay(get(/^date\s*:\s*/i));
    if (!day) return;
    const year = day.year ?? inferYear(day.month, day.day, now);
    const times = parseTimes(get(/^time\s*:\s*/i));
    const location = get(/^(location|where|place)\s*:\s*/i);
    const details = get(/^(details?|description)\s*:\s*/i).replace(/\s*(check back every \w+ for more events!?\s*)?report abuse\s*page details[\s\S]*$/i, "").replace(/\s*check back every \w+ for more events!?\s*$/i, "").trim();
    const canceled = CANCEL.test(location) || CANCEL.test(title) || /^cancell?ed\b/i.test(details);
    const place = canceled && CANCEL.test(location) ? "" : location.slice(0, 120);
    out.push(build({ title, year, month: day.month, day: day.day, times, place, details, canceled, zone, sourceUrl }));
  });
  return out;
}

function build(a: { title: string; year: number; month: number; day: number; times: ReturnType<typeof parseTimes>; place: string; details: string; canceled: boolean; zone: string; sourceUrl: string }): SourceEvent {
  const allDay = a.times === null || a.times === "allday";
  const startClock = allDay ? { h: 0, m: 0 } : (a.times as { start: Clock }).start;
  const starts = zonedToUtc(a.year, a.month, a.day, startClock.h, startClock.m, a.zone);
  let ends: Date | undefined;
  if (allDay) ends = new Date(zonedToUtc(a.year, a.month, a.day + 1, 0, 0, a.zone).getTime() - 60000);
  else if ((a.times as { end?: Clock }).end) {
    const e = (a.times as { end: Clock }).end;
    ends = zonedToUtc(a.year, a.month, a.day, e.h, e.m, a.zone);
    if (ends.getTime() <= starts.getTime()) ends = new Date(ends.getTime() + 86400000); // past midnight
  }
  const note = allDay && a.times === "allday" ? "All day. " : allDay ? "Time to be announced. " : "";
  const tail = a.sourceUrl ? `${a.details || note ? " " : ""}More at ${a.sourceUrl}` : "";
  const description = `${note}${a.details}`.trim();
  return {
    key: keyFor(a.title, a.year, a.month, a.day), title: a.title.replace(CANCEL, "").replace(/^[\s\-:]+|[\s\-:]+$/g, "").slice(0, 120) || a.title.slice(0, 120),
    startsAt: starts.toISOString(), endsAt: ends?.toISOString(), allDay, place: a.place,
    description: (description.length + tail.length > 1000 ? description.slice(0, 1000 - tail.length - 1) + "…" : description) + tail,
    canceled: a.canceled,
  };
}

/* ---------- 2. a calendar feed ---------- */

const unescapeIcs = (v: string) => v.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");

function icsMoment(value: string, params: string, zone: string): { at: Date; date: boolean } | null {
  const v = value.trim();
  const d = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!d) return null;
  const [y, mo, da] = [Number(d[1]), Number(d[2]), Number(d[3])];
  if (d[4] === undefined) return { at: zonedToUtc(y, mo, da, 0, 0, zone), date: true };
  if (d[7]) return { at: new Date(Date.UTC(y, mo - 1, da, Number(d[4]), Number(d[5]))), date: false };
  const tz = params.match(/TZID=([^;:]+)/i)?.[1]?.replace(/^"|"$/g, "");
  let z = zone;
  try { if (tz) { new Intl.DateTimeFormat("en-US", { timeZone: tz }); z = tz; } } catch { /* an unknown zone name: use the campus's */ }
  return { at: zonedToUtc(y, mo, da, Number(d[4]), Number(d[5]), z), date: false };
}

/** A calendar feed (.ics). Repeating events are listed once, at their first date. */
export function parseIcs(text: string, zone = DEFAULT_ZONE, sourceUrl = ""): SourceEvent[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const out: SourceEvent[] = [];
  let cur: Record<string, { value: string; params: string }> | null = null;
  for (const line of unfolded) {
    if (/^BEGIN:VEVENT/i.test(line)) { cur = {}; continue; }
    if (/^END:VEVENT/i.test(line)) {
      if (cur) {
        const s = cur.DTSTART && icsMoment(cur.DTSTART.value, cur.DTSTART.params, zone);
        const title = unescapeIcs(cur.SUMMARY?.value ?? "").trim();
        if (s && title) {
          const e = cur.DTEND && icsMoment(cur.DTEND.value, cur.DTEND.params, zone);
          // An all-day event ends the day before its DTEND.
          let ends = e ? (s.date ? new Date(e.at.getTime() - 60000) : e.at) : s.date ? new Date(s.at.getTime() + 86400000 - 60000) : undefined;
          if (ends && ends.getTime() <= s.at.getTime()) ends = undefined;
          const local = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(s.at);
          const [y, mo, d] = local.split("-").map(Number);
          const uid = cur.UID?.value.trim();
          const body = unescapeIcs(cur.DESCRIPTION?.value ?? "").replace(/\s+/g, " ").trim();
          const link = sourceUrl ? `${body ? " " : ""}More at ${sourceUrl}` : "";
          out.push({
            key: uid ? `uid:${uid}`.slice(0, 120) : keyFor(title, y, mo, d), title: title.slice(0, 120), startsAt: s.at.toISOString(), endsAt: ends?.toISOString(), allDay: s.date,
            place: unescapeIcs(cur.LOCATION?.value ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
            description: (body.length + link.length > 1000 ? body.slice(0, 1000 - link.length - 1) + "…" : body) + link,
            canceled: /cancel/i.test(cur.STATUS?.value ?? "") || CANCEL.test(title),
          });
        }
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const m = line.match(/^([A-Za-z-]+)((?:;[^:]*)?):(.*)$/);
    if (m) cur[m[1].toUpperCase()] = { value: m[3], params: m[2] };
  }
  return out;
}

/** Whatever the address returned: a calendar feed or a page. */
export function readSource(body: string, contentType: string, now = new Date(), zone = DEFAULT_ZONE, sourceUrl = ""): SourceEvent[] {
  if (/text\/calendar/i.test(contentType) || /^\s*BEGIN:VCALENDAR/i.test(body)) return parseIcs(body, zone, sourceUrl);
  return parseEventPage(body, now, zone, sourceUrl);
}

/* ---------- the address itself ---------- */

/** Is this an address the server may fetch? Only plain https addresses of public websites. Returns a reason in words, or null. */
export function problemWithSourceUrl(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return "That does not look like a web address."; }
  if (u.protocol !== "https:") return "Use an address that starts with https://.";
  if (u.username || u.password) return "Leave out any username or password in the address.";
  if (u.port && u.port !== "443") return "Use a normal web address without a port number.";
  const h = u.hostname.toLowerCase();
  if (!h.includes(".") || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(":") || h === "localhost" || /\.(local|internal|localhost|lan|home|corp)$/.test(h)) return "Use the address of a public website, not a number or a private network.";
  if (raw.length > 400) return "That address is too long.";
  return null;
}

/* ---------- deciding what to change ---------- */

export type StoredEvent = { id: string; external_key: string; title: string; description: string; place_name: string; starts_at: string; ends_at: string | null; canceled_at: string | null; status: string };
export type Plan = {
  add: SourceEvent[];
  change: { id: string; patch: { title: string; description: string; place_name: string; starts_at: string; ends_at: string | null } }[];
  cancel: string[];
  /** Taken off the page before they happened: hidden, and brought back if they return. */
  hide: string[];
  restore: string[];
};

const sameInstant = (a: string | null | undefined, b: string | null | undefined) => (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);

/** Compare what the page lists now with what was imported before. Never hides anything when the page listed nothing (a broken page must not empty the calendar). */
export function planSync(found: SourceEvent[], stored: StoredEvent[], now = new Date()): Plan {
  const plan: Plan = { add: [], change: [], cancel: [], hide: [], restore: [] };
  const byKey = new Map(stored.map((s) => [s.external_key, s]));
  const seen = new Set<string>();
  const finished = (e: { startsAt: string; endsAt?: string }) => new Date(e.endsAt ?? new Date(e.startsAt).getTime() + 3 * 3600000).getTime() < now.getTime() - 86400000;
  for (const f of found) {
    if (seen.has(f.key)) continue;
    seen.add(f.key);
    const old = byKey.get(f.key);
    if (!old) { if (!finished(f)) plan.add.push(f); continue; }
    if (old.status === "removed") plan.restore.push(old.id);
    if (old.title !== f.title || old.description !== f.description || old.place_name !== f.place || !sameInstant(old.starts_at, f.startsAt) || !sameInstant(old.ends_at, f.endsAt)) {
      plan.change.push({ id: old.id, patch: { title: f.title, description: f.description, place_name: f.place, starts_at: f.startsAt, ends_at: f.endsAt ?? null } });
    }
    if (f.canceled && !old.canceled_at) plan.cancel.push(old.id);
  }
  if (found.length) {
    for (const s of stored) {
      if (seen.has(s.external_key) || s.status === "removed" || s.canceled_at) continue;
      if (new Date(s.starts_at).getTime() > now.getTime()) plan.hide.push(s.id);
    }
  }
  return plan;
}
