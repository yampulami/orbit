/** Read a calendar file (.ics, as exported by Google Calendar, Apple Calendar, Outlook and most school portals) and pull out the weekly classes in it.
 *  Only events that repeat weekly become classes; one-off events are counted and left out. Pure: text in, list out. */
export type ImportedClass = { name: string; days: number[]; start: string; end: string; place?: string };
export type IcsResult = { classes: ImportedClass[]; skipped: number };

const DAY_CODES: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/** Undo the line folding in the file (a line that starts with a space or tab continues the one above). */
const unfold = (text: string) => text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
const unescape = (s: string) => s.replace(/\n/gi, " ").replace(/\,/g, ",").replace(/\;/g, ";").replace(/\\/g, "\\").trim();

/** A date-time value as local hours and minutes. A "Z" (UTC) value is converted to the device's time; others are taken as written. */
function clock(value: string): { h: number; m: number; date: Date } | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (z) { const dt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi)); return { h: dt.getHours(), m: dt.getMinutes(), date: dt }; }
  const dt = new Date(+y, +mo - 1, +d, +h, +mi);
  return { h: +h, m: +mi, date: dt };
}
const hhmm = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

export function parseIcs(text: string): IcsResult {
  const lines = unfold(text);
  const out: ImportedClass[] = [];
  let skipped = 0;
  let ev: Record<string, string> | null = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === "BEGIN:VEVENT") { ev = {}; continue; }
    if (line === "END:VEVENT" && ev) {
      const cls = toClass(ev);
      if (cls) out.push(cls); else skipped++;
      ev = null; continue;
    }
    if (!ev) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const name = line.slice(0, i).split(";")[0].toUpperCase();
    if (!(name in ev)) ev[name] = line.slice(i + 1);
  }
  // The same class often appears once per weekday; combine those that match.
  const merged: ImportedClass[] = [];
  for (const c of out) {
    const same = merged.find((x) => x.name === c.name && x.start === c.start && x.end === c.end && (x.place ?? "") === (c.place ?? ""));
    if (same) same.days = [...new Set([...same.days, ...c.days])].sort(); else merged.push({ ...c, days: [...c.days].sort() });
  }
  return { classes: merged, skipped };
}

function toClass(ev: Record<string, string>): ImportedClass | null {
  const rule = ev.RRULE;
  if (!rule || !/FREQ=WEEKLY/i.test(rule)) return null; // only weekly repeats are classes
  const s = ev.DTSTART && clock(ev.DTSTART), e = ev.DTEND && clock(ev.DTEND);
  if (!s || !e) return null;
  const by = /BYDAY=([^;]+)/i.exec(rule)?.[1];
  const days = by ? by.split(",").map((d) => DAY_CODES[d.replace(/[^A-Z]/gi, "").slice(-2).toUpperCase()]).filter((d) => d !== undefined) : [s.date.getDay()];
  const start = s.h * 60 + s.m, end = e.h * 60 + e.m;
  if (days.length === 0 || end <= start) return null;
  const name = unescape(ev.SUMMARY ?? "").slice(0, 60);
  if (!name) return null;
  const place = unescape(ev.LOCATION ?? "").slice(0, 60);
  return { name, days, start: hhmm(s.h, s.m), end: hhmm(e.h, e.m), ...(place ? { place } : {}) };
}
