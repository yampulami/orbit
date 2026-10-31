/** Days and times the way a student says them: "Today", "Tomorrow", "Mon", and "2h ago", never "10/24/2026". One set of words for the whole Feed. */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const DAY = 86400000;

/** "Today", "Tomorrow", "Mon" (within the next six days), otherwise "Nov 7". */
export function dayWord(d: Date, now = new Date()): string {
  const diff = Math.round((startOfDay(d) - startOfDay(now)) / DAY);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return WEEKDAYS[d.getDay()];
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** "9:00 AM". */
export const clock = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** How long ago: "just now", "12m ago", "3h ago", "Yesterday", "Mon" (within the last six days), otherwise "Oct 24". */
export function ago(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const m = Math.max(0, Math.round((now.getTime() - then.getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440 && startOfDay(then) === startOfDay(now)) return `${Math.round(m / 60)}h ago`;
  const back = Math.round((startOfDay(now) - startOfDay(then)) / DAY);
  if (back <= 1) return back === 0 ? `${Math.round(m / 60)}h ago` : "Yesterday";
  if (back < 7) return WEEKDAYS[then.getDay()];
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
