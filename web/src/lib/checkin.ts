import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { loadNames, watchTables } from "./people";
import { findByUsername } from "./username";
import { siteUrl } from "./siteUrl";
import { notice } from "./notice";

/** Event check-in. The people running an event show a QR code that changes every 30 seconds; a student scans it (or types the six letters under it) while the
 *  event is on. The code is made and checked by the database, so it cannot be worked out from this screen. Students keep a private record of what they attended. */
export const SLOT_S = 30;
const HOUR = 3600000;

/** Is check-in open? From an hour before the event until an hour after it ends (three hours after the start when it has no end). */
export const checkinOpen = (e: { startsAt: string; endsAt?: string }, now: Date) => {
  const start = new Date(e.startsAt).getTime();
  const end = e.endsAt ? new Date(e.endsAt).getTime() : start + 3 * HOUR;
  return now.getTime() >= start - HOUR && now.getTime() <= end + HOUR;
};
/** The link inside the QR code: opening it checks the person in. */
export const checkinUrl = (eventId: string, code: string) => `${siteUrl()}/app/checkin/${eventId}?c=${encodeURIComponent(code)}`;

/* ---------- demo codes (the demo has no database) ---------- */
export const slotAt = (ms: number) => Math.floor(ms / 1000 / SLOT_S);
/** Pure: a six-letter code for an event and a 30-second slot. Demo only: the real code comes from the database. */
export function demoCode(eventId: string, slot: number): string {
  let h = 2166136261;
  for (const ch of `${eventId}:${slot}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  let out = "";
  for (let i = 0; i < 6; i++) { out += "ABCDEFGHJKMNPQRSTUVWXYZ"[h % 23]; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; }
  return out;
}

export type MyCheckin = { event_id: string; method: "qr" | "manual"; checked_in_at: string; title: string; starts_at: string; host: string };
type Raw = { event_id: string; user_id?: string; method: "qr" | "manual"; checked_in_at: string; campus_events?: { title: string; starts_at: string; host_label: string } | null };

const live = !!supabase;
const DEMO_KEY = "orbit-demo-checkins";
const DEMO_ME = "demo-me";
type DemoRow = { event_id: string; user_id: string; method: "qr" | "manual"; checked_in_at: string; title?: string; starts_at?: string; host?: string };
const readDemo = (): DemoRow[] => { try { const s = localStorage.getItem(DEMO_KEY); if (s) return JSON.parse(s) as DemoRow[]; } catch { /* none */ } return []; };
const writeDemo = (d: DemoRow[]) => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(d)); } catch { /* ignore */ } };

/* ---------- my own check-ins ---------- */
let mine: MyCheckin[] = [];
let who: string | null = null;
let stop: (() => void) | null = null;
const subs = new Set<() => void>();
const set = (next: MyCheckin[]) => { mine = next; subs.forEach((f) => f()); };

async function reload() {
  if (!live) { set(readDemo().filter((r) => r.user_id === DEMO_ME).map((r) => ({ event_id: r.event_id, method: r.method, checked_in_at: r.checked_in_at, title: r.title ?? "Event", starts_at: r.starts_at ?? r.checked_in_at, host: r.host ?? "" })).sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at))); return; }
  if (!who) return;
  const me = who;
  const { data, error } = await supabase!.from("campus_event_checkins").select("event_id,method,checked_in_at,campus_events(title,starts_at,host_label)").eq("user_id", me).order("checked_in_at", { ascending: false }).limit(100);
  // Before the check-in migration is applied the table is missing: no record, never an error.
  if (error) { if (who === me) set([]); return; }
  if (who !== me) return;
  set(((data ?? []) as unknown as Raw[]).map((r) => ({ event_id: r.event_id, method: r.method, checked_in_at: r.checked_in_at, title: r.campus_events?.title ?? "Event", starts_at: r.campus_events?.starts_at ?? r.checked_in_at, host: r.campus_events?.host_label ?? "" })));
}
export function bindCheckins(userId: string) {
  if (!live) { void reload(); return; }
  if (who === userId) return;
  unbindCheckins();
  who = userId;
  void reload();
  stop = watchTables(`orbit-checkins-${userId}`, ["campus_event_checkins"], () => void reload());
}
export function unbindCheckins() {
  if (!live) return;
  stop?.(); stop = null; who = null; set([]);
}
/** The events I have checked in to, newest first. */
export const useMyCheckins = () => {
  const list = useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => mine);
  return { list, ids: new Set(list.map((c) => c.event_id)) };
};

const fail = (message: string) => { notice.show({ icon: "alert", title: "That did not work", message }); return message; };

export const checkinActions = {
  /** The people running an event: the code to show right now, and how many seconds it has left. */
  async getCode(eventId: string): Promise<{ code: string; secondsLeft: number } | { error: string }> {
    if (!live) { const now = Date.now(); return { code: demoCode(eventId, slotAt(now)), secondsLeft: SLOT_S - (Math.floor(now / 1000) % SLOT_S) }; }
    const { data, error } = await supabase!.rpc("get_checkin_code", { event: eventId });
    const row = (Array.isArray(data) ? data[0] : data) as { code: string; seconds_left: number } | undefined;
    if (error || !row) return { error: error?.message ?? "Could not get the code." };
    return { code: row.code, secondsLeft: row.seconds_left };
  },
  /** A student checks in with the code from the screen. */
  async checkIn(eventId: string, code: string, event?: { title: string; startsAt: string; host: string }): Promise<string | null> {
    const given = code.trim().toUpperCase();
    if (!given) return "Enter the code shown on the screen.";
    if (!live) {
      const slot = slotAt(Date.now());
      if (given !== demoCode(eventId, slot) && given !== demoCode(eventId, slot - 1)) return "That code did not match. Scan the code on screen again.";
      const rows = readDemo();
      if (!rows.some((r) => r.event_id === eventId && r.user_id === DEMO_ME)) writeDemo([...rows, { event_id: eventId, user_id: DEMO_ME, method: "qr", checked_in_at: new Date().toISOString(), title: event?.title, starts_at: event?.startsAt, host: event?.host }]);
      await reload();
      return null;
    }
    const { error } = await supabase!.rpc("check_in", { event: eventId, code: given });
    if (error) return error.message;
    await reload();
    return null;
  },
  /** The people running an event check someone in by hand (for accessibility, or a phone that died). */
  async manualCheckIn(eventId: string, username: string): Promise<string | null> {
    const found = await findByUsername(username);
    if (!found) return `Nobody on your campus has the username @${username.replace(/^@/, "")}.`;
    const { error } = await supabase!.rpc("manual_check_in", { event: eventId, member: found.id });
    return error ? fail(error.message) : null;
  },
  async remove(eventId: string, userId: string): Promise<string | null> {
    if (!live) { writeDemo(readDemo().filter((r) => !(r.event_id === eventId && r.user_id === userId))); await reload(); return null; }
    const { error } = await supabase!.rpc("remove_check_in", { event: eventId, member: userId });
    if (error) return fail(error.message);
    await reload();
    return null;
  },
};

/** Who has checked in to one event (for the people running it). Refreshes every few seconds while open. */
export function useAttendance(eventId: string, enabled: boolean) {
  const [rows, setRows] = useState<{ userId: string; name: string; method: "qr" | "manual"; at: string }[]>([]);
  const load = useCallback(async () => {
    if (!live) { setRows(readDemo().filter((r) => r.event_id === eventId).map((r) => ({ userId: r.user_id, name: r.user_id === DEMO_ME ? "You" : "Student", method: r.method, at: r.checked_in_at })).sort((a, b) => a.at.localeCompare(b.at))); return; }
    const { data, error } = await supabase!.from("campus_event_checkins").select("user_id,method,checked_in_at").eq("event_id", eventId).order("checked_in_at", { ascending: true }).limit(2000);
    if (error) return;
    const list = (data ?? []) as { user_id: string; method: "qr" | "manual"; checked_in_at: string }[];
    const names = await loadNames(list.map((r) => r.user_id)).catch(() => ({}));
    setRows(list.map((r) => ({ userId: r.user_id, name: (names as Record<string, string>)[r.user_id] ?? "Student", method: r.method, at: r.checked_in_at })));
  }, [eventId]);
  useEffect(() => {
    if (!enabled) return;
    void load();
    const t = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 8000);
    return () => window.clearInterval(t);
  }, [enabled, load]);
  return { rows, reload: load };
}
