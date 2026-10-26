import { supabase } from "./supabase";
import { notice } from "./notice";
import type { Reminder } from "./reminders";
import type { Pin, PinKind } from "./pins";

/** Reminders and pins in the database. Both are private to their owner, so the rules in the database only ever return your own rows. */
export type ReminderRow = { id: string; user_id: string; title: string; remind_on: string; remind_at: string | null; done: boolean; notified: boolean; /** The exact moment, so the server can send a push on time. */ due_at?: string | null };
export type PinRow = { user_id: string; kind: PinKind; item_id: string };

/** The database stores a time of day as "15:00:00"; the app uses "15:00". */
export const toReminder = (r: ReminderRow): Reminder => ({ id: r.id, title: r.title, date: r.remind_on, time: r.remind_at ? r.remind_at.slice(0, 5) : undefined, done: r.done, notified: r.notified });
/** The reminder's date and local time as one exact moment (null when it has no time, or the time is not valid). */
const dueAt = (r: Reminder) => {
  if (!r.time) return null;
  const d = new Date(`${r.date}T${r.time}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
export const toReminderRow = (userId: string, r: Reminder): ReminderRow => ({ id: r.id, user_id: userId, title: r.title, remind_on: r.date, remind_at: r.time || null, done: r.done, notified: !!r.notified, due_at: dueAt(r) });
export const toPin = (r: Pick<PinRow, "kind" | "item_id">): Pin => ({ kind: r.kind, id: r.item_id });

export async function loadReminders(): Promise<Reminder[]> {
  const { data, error } = await supabase!.from("reminders").select("id,user_id,title,remind_on,remind_at,done,notified").order("remind_on", { ascending: true }).order("remind_at", { ascending: true, nullsFirst: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ReminderRow[]).map(toReminder);
}

export async function loadPins(): Promise<Pin[]> {
  const { data, error } = await supabase!.from("user_pins").select("kind,item_id").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Pick<PinRow, "kind" | "item_id">[]).map(toPin);
}

/** Run a change in the database. If it fails, say so in plain words and let the caller show what is really saved. */
export function dbRun(what: string, job: () => PromiseLike<{ error: { message: string } | null }>, afterFail: () => void, afterSave?: () => void) {
  Promise.resolve(job()).then(({ error }) => { if (error) throw new Error(error.message); afterSave?.(); }).catch((e: Error) => {
    notice.show({ icon: "alert", title: `${what} did not work`, message: e.message || "Something went wrong. Try again." });
    afterFail();
  });
}

/** Call `refresh` whenever the person comes back to this tab, so a change made on another device shows up. */
export function refreshOnReturn(refresh: () => void): () => void {
  const on = () => { if (document.visibilityState === "visible") refresh(); };
  document.addEventListener("visibilitychange", on);
  return () => document.removeEventListener("visibilitychange", on);
}
