import { useSyncExternalStore } from "react";

/** A student's weekly class schedule: which days, what time, where. It shows on the week board, the day's agenda and "Coming up".
 *  It is kept on this device for now (per person), so it needs no database. */
export type ClassSlot = { id: string; name: string; /** 0 = Sunday ... 6 = Saturday */ days: number[]; /** "HH:MM", 24 hour */ start: string; end: string; place?: string };

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
/** Monday first, the way a school week reads. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Minutes after midnight for "HH:MM". */
export const toMinutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
export const clockLabel = (t: string) => new Date(`2000-01-01T${t}`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** What is wrong with this class, in plain words, or null if it is fine. */
export function problemWith(c: { name: string; days: number[]; start: string; end: string }): string | null {
  if (!c.name.trim()) return "Give the class a name.";
  if (c.days.length === 0) return "Pick at least one day.";
  if (toMinutes(c.end) <= toMinutes(c.start)) return "The class has to end after it starts.";
  return null;
}

/** The classes that meet on this date, earliest first. */
export const classesOn = (slots: ClassSlot[], date: Date) => slots.filter((c) => c.days.includes(date.getDay())).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

/** The next time any class starts (or is under way within the last 10 minutes) from `now`, looking up to a week ahead. */
export function nextClass(slots: ClassSlot[], now: Date): { slot: ClassSlot; starts: Date } | null {
  let best: { slot: ClassSlot; starts: Date } | null = null;
  for (let i = 0; i < 8; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    for (const slot of classesOn(slots, day)) {
      const m = toMinutes(slot.start);
      const starts = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(m / 60), m % 60);
      if (starts.getTime() < now.getTime() - 10 * 60000) continue;
      if (!best || starts.getTime() < best.starts.getTime()) best = { slot, starts };
    }
    if (best) break; // the first day with a class has the soonest one
  }
  return best;
}

/* ---------- store ---------- */
const KEY = "orbit-classes-v1:";
let owner: string | null = null;
let state: ClassSlot[] = [];
const subs = new Set<() => void>();
function set(next: ClassSlot[]) {
  state = next;
  if (owner) { try { localStorage.setItem(KEY + owner, JSON.stringify(state)); } catch { /* storage full or unavailable */ } }
  subs.forEach((f) => f());
}

export function bindClasses(userId: string) {
  if (owner === userId) return;
  owner = userId;
  try { const s = localStorage.getItem(KEY + userId); state = s ? (JSON.parse(s) as ClassSlot[]) : []; } catch { state = []; }
  subs.forEach((f) => f());
}
export function unbindClasses() { owner = null; state = []; subs.forEach((f) => f()); }

export const classActions = {
  add(c: Omit<ClassSlot, "id">): string | null {
    const bad = problemWith(c);
    if (bad) return bad;
    set([...state, { ...c, id: crypto.randomUUID(), name: c.name.trim().slice(0, 60), place: c.place?.trim().slice(0, 60) || undefined, days: [...new Set(c.days)].sort() }]);
    return null;
  },
  remove(id: string) {
    const index = state.findIndex((c) => c.id === id);
    if (index < 0) return null;
    const item = state[index];
    set(state.filter((c) => c.id !== id));
    return { item, index };
  },
  restore(item: ClassSlot, index: number) {
    if (state.some((c) => c.id === item.id)) return;
    const next = [...state]; next.splice(Math.min(index, next.length), 0, item); set(next);
  },
};

export const useClasses = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
