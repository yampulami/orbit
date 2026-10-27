import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { ChangeEvent } from "./people";

/** A fast "something changed here" signal between the people in the same household, group chat or conversation.
 *
 *  The database's own change feed is reliable but can take half a second. When someone saves something, their app also sends a tiny note over a
 *  quick channel for that room: just the table and the id, never the content. The other people's apps then fetch that one row (the database rules
 *  still decide whether they may see it) and show it. Nobody can use the note to show something that is not really in the database. */
/** `by` names the row when it has no single id (a hangout answer is found by the hangout and the person). */
export type Nudge = { table: string; id: string; op: "upsert" | "delete"; by?: Record<string, string> };

const ALLOWED = new Set(["household_tasks", "household_groceries", "household_expenses", "household_notes", "household_payments", "group_messages", "direct_messages", "campus_hangouts", "campus_hangout_rsvps"]);
const BY_KEYS = new Set(["hangout_id", "user_id"]);

type Room = { ch: RealtimeChannel; listeners: Map<string, (n: Nudge) => void>; typing: Set<(userId: string) => void> };
const rooms = new Map<string, Room>();
const listening = new Map<string, Set<string>>(); // who (a store) to the rooms it listens in

function room(id: string): Room {
  let r = rooms.get(id);
  if (!r) {
    const listeners = new Map<string, (n: Nudge) => void>();
    const typing = new Set<(userId: string) => void>();
    const ch = supabase!.channel(`nudge-${id}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "n" }, (m: { payload?: unknown }) => {
      const n = m.payload as Partial<Nudge> | undefined;
      if (!n || typeof n.id !== "string" || typeof n.table !== "string" || !ALLOWED.has(n.table) || (n.op !== "upsert" && n.op !== "delete")) return;
      if (n.by !== undefined) {
        const by = n.by as unknown;
        if (typeof by !== "object" || by === null || Object.entries(by).some(([k, v]) => !BY_KEYS.has(k) || typeof v !== "string")) return;
      }
      listeners.forEach((f) => f(n as Nudge));
    });
    ch.on("broadcast", { event: "t" }, (m: { payload?: unknown }) => {
      const u = (m.payload as { u?: unknown } | undefined)?.u;
      if (typeof u === "string") typing.forEach((f) => f(u));
    });
    ch.subscribe();
    r = { ch, listeners, typing };
    rooms.set(id, r);
  }
  return r;
}

/** Listen in these rooms for `who` (replacing what `who` listened in before). Pass an empty list to stop. */
export function listenRooms(who: string, ids: string[], onNudge: (n: Nudge) => void) {
  if (!supabase) return;
  const next = new Set(ids);
  const before = listening.get(who) ?? new Set<string>();
  for (const id of before) {
    if (next.has(id)) continue;
    const r = rooms.get(id);
    r?.listeners.delete(who);
    if (r && r.listeners.size === 0) { void supabase.removeChannel(r.ch); rooms.delete(id); }
  }
  for (const id of next) room(id).listeners.set(who, onNudge);
  if (next.size) listening.set(who, next); else listening.delete(who);
}

/** Tell the others in this room that something was saved. Call it after the database accepted the change. */
export function sendNudge(roomId: string | null | undefined, n: Nudge) {
  if (!supabase || !roomId) return;
  try {
    const r = room(roomId);
    void Promise.resolve(r.ch.send({ type: "broadcast", event: "n", payload: n })).catch(() => undefined);
    // A room nobody here listens in (someone else's inbox) is closed again shortly after.
    if (r.listeners.size === 0) setTimeout(() => { if (r.listeners.size === 0 && rooms.get(roomId) === r) { void supabase!.removeChannel(r.ch); rooms.delete(roomId); } }, 3000);
  } catch { /* the slower change feed still delivers it */ }
}

/** The row a note points at, as a change event ready to be applied; null if it is gone or this person may not see it. */
export async function fetchChange(table: string, id: string, by?: Record<string, string>): Promise<ChangeEvent | null> {
  let q = supabase!.from(table).select("*");
  q = by ? Object.entries(by).reduce((acc, [k, v]) => acc.eq(k, v), q) : q.eq("id", id);
  const { data, error } = await q.maybeSingle();
  if (error || !data) return null;
  return { table, type: "INSERT", row: data as Record<string, unknown>, old: {} };
}

/** "Someone is typing" in a room. It carries only who, and is never kept. Call `sendTyping` as you type (it is sent at most every couple of seconds). */
let lastTyping = 0;
export function sendTyping(roomId: string | null | undefined, userId: string) {
  if (!supabase || !roomId || Date.now() - lastTyping < 2500) return;
  lastTyping = Date.now();
  try { void Promise.resolve(room(roomId).ch.send({ type: "broadcast", event: "t", payload: { u: userId } })).catch(() => undefined); } catch { /* it is only a nicety */ }
}

/** Be told when someone types in this room. Returns a function that stops listening. */
export function onTyping(roomId: string, cb: (userId: string) => void): () => void {
  if (!supabase) return () => undefined;
  const r = room(roomId);
  r.typing.add(cb);
  return () => { r.typing.delete(cb); };
}
