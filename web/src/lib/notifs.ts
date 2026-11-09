import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { refreshOnReturn } from "./privateDb";
import { watchTables } from "./people";
import { loadNotifs, type Notif } from "./notifsDb";

/** The student's notifications from the database, kept up to date. Without a database there are none (the bell still shows what is due). */
const live = !!supabase;
/** Demo only: a few made-up notifications so the bell is not empty. */
const demoNotifs = (): Notif[] => {
  const ago = (m: number) => new Date(Date.now() - m * 60000).toISOString();
  return [
    { id: 1, kind: "message", actorId: "demo-cam", actor: "Cam", title: "Cam sent you a message", sub: "hi", to: "/app/chats", unread: true, at: ago(2) },
    { id: 2, kind: "friend_request", actorId: "demo-cam", actor: "Cam", title: "Cam wants to be your friend", to: "/app/people/demo-cam", unread: true, at: ago(3) },
    { id: 3, kind: "friend_accept", actorId: "demo-yami", actor: "Yami", title: "Yami accepted your friend request", to: "/app/people/demo-yami", unread: false, at: ago(5) },
  ];
};
let state: Notif[] = live ? [] : demoNotifs();
const subs = new Set<() => void>();
function set(next: Notif[]) { state = next; subs.forEach((f) => f()); }

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
    if (!state.find((n) => n.id === id)?.unread) return;
    set(state.map((n) => (n.id === id ? { ...n, unread: false } : n)));
    if (!live || !who) return;
    Promise.resolve(supabase!.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id)).then(undefined, () => void reload());
  },
  markAllRead() {
    if (!state.some((n) => n.unread)) return;
    set(state.map((n) => ({ ...n, unread: false })));
    if (!live || !who) return;
    Promise.resolve(supabase!.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null).eq("recipient_id", who)).then(undefined, () => void reload());
  },
};

export const useNotifs = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
