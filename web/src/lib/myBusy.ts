import type { ClassSlot } from "./classes";
import { clockLabel, toMinutes } from "./classes";
import { blocksFromClasses, type Person } from "./freeTime";

/** Everything that makes the student busy, in the same terms as their Plans agenda: classes, hangouts they have not turned down, events they are going to, interested in or hosting,
 *  and reminders with a time. Pure: the screens pass in what they already have. */
export type BusyInput = {
  classes: ClassSlot[];
  hangouts: { title: string; when: string; canceled?: boolean; rsvp?: "yes" | "no" | null; visible?: boolean }[];
  events: { title: string; startsAt: string; endsAt?: string; canceled?: boolean; status?: string; mine?: string; mineHost?: boolean }[];
  reminders: { title: string; date: string; time?: string; done: boolean }[];
};
export type BusyItem = { label: string; kind: "class" | "hangout" | "event" | "reminder"; start: Date; end: Date };

const HOUR = 3600_000;

/** What is on during one calendar day, soonest first. */
export function busyOn(input: BusyInput, day: Date): BusyItem[] {
  const out: BusyItem[] = [];
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  for (const c of input.classes) {
    if (!c.days.includes(day.getDay())) continue;
    const s = toMinutes(c.start), e = toMinutes(c.end);
    out.push({ label: c.name, kind: "class", start: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, s), end: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, e) });
  }
  for (const h of input.hangouts) {
    if (h.canceled || h.visible === false || h.rsvp === "no") continue;
    const s = new Date(h.when);
    if (Number.isNaN(s.getTime()) || s.toDateString() !== day.toDateString()) continue;
    out.push({ label: h.title, kind: "hangout", start: s, end: new Date(s.getTime() + 2 * HOUR) });
  }
  for (const e of input.events) {
    if (e.canceled || (e.status && e.status !== "published" && !e.mineHost)) continue;
    if (!(e.mine === "going" || e.mine === "interested" || e.mineHost)) continue;
    const s = new Date(e.startsAt);
    if (Number.isNaN(s.getTime()) || s.toDateString() !== day.toDateString()) continue;
    out.push({ label: e.title, kind: "event", start: s, end: e.endsAt ? new Date(e.endsAt) : new Date(s.getTime() + 2 * HOUR) });
  }
  for (const r of input.reminders) {
    if (r.done || !r.time || r.date !== ymd(day)) continue;
    const [h, m] = r.time.split(":").map(Number);
    const s = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
    out.push({ label: r.title, kind: "reminder", start: s, end: new Date(s.getTime() + 30 * 60000) });
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** The student as the free-time engine sees them. Classes repeat weekly; everything else has a real date, looked at over the next `days` days. */
export function buildMyBusy(input: BusyInput, now: Date, days = 14): Person {
  const dated: { start: Date; end: Date }[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    for (const it of busyOn({ ...input, classes: [] }, day)) dated.push({ start: it.start, end: it.end });
  }
  return { id: "me", name: "You", blocks: blocksFromClasses(input.classes), dated };
}

/** One line per thing, for "what counts as busy today". */
export const describeBusy = (it: BusyItem) => `${clockLabel(`${String(it.start.getHours()).padStart(2, "0")}:${String(it.start.getMinutes()).padStart(2, "0")}`)} to ${clockLabel(`${String(it.end.getHours() % 24).padStart(2, "0")}:${String(it.end.getMinutes()).padStart(2, "0")}`)} ${it.label}`;
