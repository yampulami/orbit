import { isVisible, YOU, type Group, type Hangout } from "./hangouts";
import { fromYmd, type Reminder } from "./reminders";
import type { Task } from "./roommates";

export type UpKind = "hangout" | "chore" | "reminder";
export type UpTag = "answer" | "overdue" | "today" | "soon" | "tomorrow";
export type UpItem = {
  id: string;
  kind: UpKind;
  title: string;
  sub: string;
  /** When it happens or is due. Undated chores have none and sort last. */
  when?: Date;
  tag?: UpTag;
  /** Where clicking should go. */
  to: string;
  state?: Record<string, unknown>;
  reminderId?: string;
};

const HOUR = 3600000;
const DAY = 86400000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const dayLabel = (d: Date, now: Date) => {
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / DAY);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};
/** "Today" reads as "due today" in a sentence; a date like "Thu, Oct 22" keeps its capitals. */
const soft = (label: string) => (/^(Today|Tomorrow|Yesterday)$/.test(label) ? label.toLowerCase() : label);
const timeLabel = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** Everything coming up, soonest first: hangouts, your chores and your reminders. Overdue things come first so they are not missed. */
export function buildUpcoming(o: { now: Date; groups: Group[]; hangouts: Hangout[]; tasks: Task[]; reminders: Reminder[]; limit?: number }): UpItem[] {
  const { now } = o;
  const items: UpItem[] = [];

  for (const h of o.hangouts) {
    const when = new Date(h.when);
    if (!isVisible(h, o.groups)) continue;
    if (when.getTime() < now.getTime() - 3 * HOUR || when.getTime() > now.getTime() + 30 * DAY) continue;
    const mine = h.rsvps[YOU];
    const untilMs = when.getTime() - now.getTime();
    const tag: UpTag | undefined = !mine ? "answer" : untilMs <= 3 * HOUR ? "soon" : startOfDay(when).getTime() === startOfDay(now).getTime() ? "today" : untilMs <= 2 * DAY && startOfDay(when).getTime() - startOfDay(now).getTime() === DAY ? "tomorrow" : undefined;
    items.push({ id: `h-${h.id}`, kind: "hangout", title: h.title, sub: `${dayLabel(when, now)}, ${timeLabel(when)} · ${h.place}`, when, tag, to: "/app/plans", state: { day: when.toDateString() } });
  }

  for (const t of o.tasks) {
    if (t.done || t.assignee !== YOU) continue;
    if (t.due) {
      const when = new Date(fromYmd(t.due).getTime() + DAY - 1);
      const overdue = when.getTime() < now.getTime();
      const dueToday = !overdue && startOfDay(when).getTime() === startOfDay(now).getTime();
      items.push({ id: `t-${t.id}`, kind: "chore", title: t.title, sub: `${overdue ? "Was due" : "Due"} ${soft(dayLabel(fromYmd(t.due), now))} · ${t.points} pt${t.points === 1 ? "" : "s"}`, when, tag: overdue ? "overdue" : dueToday ? "today" : undefined, to: "/app/roommates", state: { section: "tasks" } });
    } else {
      items.push({ id: `t-${t.id}`, kind: "chore", title: t.title, sub: `No due date · ${t.points} pt${t.points === 1 ? "" : "s"}`, to: "/app/roommates", state: { section: "tasks" } });
    }
  }

  for (const r of o.reminders) {
    if (r.done) continue;
    const day = fromYmd(r.date);
    const [hh, mm] = (r.time ?? "").split(":").map(Number);
    const when = r.time ? new Date(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm) : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59);
    const overdue = when.getTime() < now.getTime();
    if (overdue && now.getTime() - when.getTime() > 7 * DAY) continue;
    if (!overdue && when.getTime() > now.getTime() + 60 * DAY) continue;
    const sameDay = startOfDay(when).getTime() === startOfDay(now).getTime();
    items.push({ id: `r-${r.id}`, kind: "reminder", title: r.title, sub: `${dayLabel(day, now)}${r.time ? `, ${timeLabel(when)}` : ""}`, when, tag: overdue ? "overdue" : sameDay ? "today" : undefined, to: "/app/plans", state: { day: day.toDateString() }, reminderId: r.id });
  }

  items.sort((a, b) => (a.when && b.when ? a.when.getTime() - b.when.getTime() : a.when ? -1 : b.when ? 1 : 0));
  return o.limit ? items.slice(0, o.limit) : items;
}
