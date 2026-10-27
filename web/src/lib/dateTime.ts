/** Helpers for the date and time picker. A value is "YYYY-MM-DDTHH:MM" in local time (the same shape the browser's own date box uses), or "" for nothing chosen. */
const pad = (n: number) => String(n).padStart(2, "0");

export const ymdOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromValue = (v: string): { date: string; time: string } | null => {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(v);
  return m ? { date: m[1], time: m[2] } : null;
};
export const toValue = (date: string, time: string) => `${date}T${time}`;

/** What the field shows: "Tue, Oct 27 · 4:00 PM", or nothing. */
export function describe(v: string, locale?: string): string {
  const p = fromValue(v);
  if (!p) return "";
  const d = new Date(`${p.date}T${p.time}`);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" })} · ${d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}`;
}

/** The weeks of a month for a calendar grid, Sunday first: every cell is a date (some from the neighbouring months), in whole weeks. */
export function monthGrid(year: number, month: number): { date: string; inMonth: boolean }[][] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const weeks: { date: string; inMonth: boolean }[][] = [];
  for (let w = 0; w < 6; w++) {
    const row = Array.from({ length: 7 }, (_, i) => { const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + i); return { date: ymdOf(d), inMonth: d.getMonth() === month }; });
    if (w >= 4 && row.every((c) => !c.inMonth)) break; // no empty last week
    weeks.push(row);
  }
  return weeks;
}

/** A sensible time to start from when only a date was picked: the next whole hour for today, otherwise 9:00 AM. */
export function defaultTime(date: string, now = new Date()): string {
  if (date !== ymdOf(now)) return "09:00";
  const h = Math.min(23, now.getHours() + 1);
  return `${pad(h)}:00`;
}
