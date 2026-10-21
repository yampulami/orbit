import { useSyncExternalStore } from "react";
import { undo } from "./undo";

/** Reminders the person sets on the calendar. Saved on this device only. */
export type Reminder = { id: string; title: string; date: string; time?: string; done: boolean; /** Already shown as an alert, so it does not pop up twice. */ notified?: boolean };

/** Quick picks for the time of a reminder. A reminder with no time alerts at 9:00 that morning. */
export const QUICK_TIMES = [
  { label: "9 AM", value: "09:00" },
  { label: "Noon", value: "12:00" },
  { label: "3 PM", value: "15:00" },
  { label: "6 PM", value: "18:00" },
];
export const DEFAULT_ALERT_TIME = "09:00";

const KEY = "orbit-reminders-v2";

/** "2026-10-23" for a local date. */
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Local midnight for "2026-10-23". */
export const fromYmd = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

/** When a reminder should alert you. */
export function dueAt(r: Reminder): Date {
  const d = fromYmd(r.date);
  const [h, m] = (r.time ?? DEFAULT_ALERT_TIME).split(":").map(Number);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
}

/** Reminders whose time has come and that have not alerted yet. */
export const dueNow = (list: Reminder[], now: Date) => list.filter((r) => !r.done && !r.notified && dueAt(r).getTime() <= now.getTime());

/** The date and time `minutes` from `now`, in the shape a reminder stores them. */
export function inMinutes(now: Date, minutes: number) {
  const t = new Date(now.getTime() + minutes * 60000);
  return { date: ymd(t), time: `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}` };
}

function load(): Reminder[] {
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s) as Reminder[]; } catch { /* storage unavailable */ }
  // Demo reminders spread across the week. They are marked as already alerted so a fresh load does not pop a pile of cards.
  const at = (d: number, time?: string, title = ""): Reminder => { const t = new Date(); t.setDate(t.getDate() + d); return { id: `demo-${d}-${title.length}`, title, date: ymd(t), time, done: false, notified: true }; };
  return [
    at(0, "15:00", "Submit CS lab"),
    at(1, "09:00", "Return library books"),
    at(2, "13:30", "Office hours with Prof. Lee"),
    at(3, undefined, "Call mom"),
    at(4, "08:30", "Gym with Jordan"),
    at(5, "11:00", "Laundry"),
  ];
}

let state: Reminder[] = load();
const subs = new Set<() => void>();
function set(next: Reminder[]) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  subs.forEach((f) => f());
}

export const reminderActions = {
  add(title: string, date: string, time?: string) {
    const r: Reminder = { id: crypto.randomUUID(), title, date, time: time || undefined, done: false };
    // One set for a moment that has already passed should not alert straight away.
    set([...state, { ...r, notified: dueAt(r).getTime() <= Date.now() }]);
  },
  markNotified(id: string) {
    set(state.map((r) => (r.id === id ? { ...r, notified: true } : r)));
  },
  /** Moves a reminder to later today and lets it alert again. */
  snooze(id: string, minutes: number) {
    const at = inMinutes(new Date(), minutes);
    set(state.map((r) => (r.id === id ? { ...r, ...at, done: false, notified: false } : r)));
  },
  setDone(id: string, done: boolean) {
    set(state.map((r) => (r.id === id ? { ...r, done } : r)));
  },
  /** Removing offers Undo for a few seconds. */
  remove(id: string) {
    const index = state.findIndex((r) => r.id === id);
    if (index < 0) return;
    const item = state[index];
    set(state.filter((r) => r.id !== id));
    undo.show(`Reminder “${item.title}” deleted`, {
      onUndo: () => { if (!state.some((r) => r.id === id)) { const next = [...state]; next.splice(Math.min(index, next.length), 0, item); set(next); } },
      commit: () => {},
    });
  },
};

export const useReminders = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
