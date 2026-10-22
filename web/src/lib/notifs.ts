import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { refreshOnReturn } from "./privateDb";
import { watchTables } from "./people";
import { loadNotifs, type Notif } from "./notifsDb";

/** The student's notifications from the database, kept up to date. Without a database there are none (the bell still shows what is due). */
let state: Notif[] = [];
const subs = new Set<() => void>();
function set(next: Notif[]) { state = next; subs.forEach((f) => f()); }
const live = !!supabase;

let who: string | null = null;
let stop: (() => void) | null = null;
let stopReturn: (() => void) | null = null;
let loadId = 0;

async function reload() {
  if (!who) return;
  const me = who, mine = ++loadId;
  try { const next = await loadNotifs(me); if (mine === loadId && who === me) set(next); } catch { /* keep what is on screen */ }
}

export function bindNotifs(userId: string) {
  if (!live || who === userId) return;
  unbindNotifs();
  who = userId;
  void reload();
  stop = watchTables(`orbit-notifs-${userId}`, ["notifications"], () => void reload());
  stopReturn = refreshOnReturn(() => void reload());
}
export function unbindNotifs() {
  if (!live) return;
  stop?.(); stop = null; stopReturn?.(); stopReturn = null;
  who = null; loadId++;
  set([]);
}

export const notifActions = {
  markRead(id: number) {
    if (!live || !who || !state.find((n) => n.id === id)?.unread) return;
    set(state.map((n) => (n.id === id ? { ...n, unread: false } : n)));
    Promise.resolve(supabase!.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id)).then(undefined, () => void reload());
  },
  markAllRead() {
    if (!live || !who || !state.some((n) => n.unread)) return;
    set(state.map((n) => ({ ...n, unread: false })));
    Promise.resolve(supabase!.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null).eq("recipient_id", who)).then(undefined, () => void reload());
  },
};

export const useNotifs = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
