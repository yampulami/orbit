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

type TypingCb = (userId: string, stopped: boolean) => void;
type Room = { ch: RealtimeChannel; listeners: Map<string, (n: Nudge) => void>; typing: Set<TypingCb>; here: Set<(others: Set<string>) => void> };
const rooms = new Map<string, Room>();
const listening = new Map<string, Set<string>>(); // who (a store) to the rooms it listens in

function room(id: string): Room {
  let r = rooms.get(id);
  if (!r) {
    const listeners = new Map<string, (n: Nudge) => void>();
    const typing = new Set<TypingCb>();
    const here = new Set<(others: Set<string>) => void>();
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
      const p = m.payload as { u?: unknown; s?: unknown } | undefined;
      if (typeof p?.u === "string") typing.forEach((f) => f(p.u as string, p.s === true));
    });
    // Who has this conversation open right now (only while a chat is open on their screen).
    ch.on("presence", { event: "sync" }, () => {
      const ids = new Set<string>();
      for (const list of Object.values(ch.presenceState() as Record<string, { u?: unknown }[]>)) for (const p of list) if (typeof p.u === "string") ids.add(p.u);
      here.forEach((f) => f(ids));
    });
    ch.subscribe();
    r = { ch, listeners, typing, here };
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
    // A room someone is watching for typing stays open even when nothing else listens in it.
    if (r && r.listeners.size === 0 && r.typing.size === 0) { void supabase.removeChannel(r.ch); rooms.delete(id); }
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
    if (r.listeners.size === 0) setTimeout(() => { if (r.listeners.size === 0 && r.typing.size === 0 && rooms.get(roomId) === r) { void supabase!.removeChannel(r.ch); rooms.delete(roomId); } }, 3000);
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
export function sendTyping(roomId: string | null | undefined, userId: string, stopped = false) {
  if (!supabase || !roomId) return;
  // "Stopped" always goes out at once; "typing" at most every second and a half, so a longer message keeps the note alive.
  if (!stopped && Date.now() - lastTyping < 1500) return;
  lastTyping = stopped ? 0 : Date.now();
  try { void Promise.resolve(room(roomId).ch.send({ type: "broadcast", event: "t", payload: stopped ? { u: userId, s: true } : { u: userId } })).catch(() => undefined); } catch { /* it is only a nicety */ }
}

/** Make sure the quick channel for this room is joined. A phone that slept can come back with the channel closed, and then nothing arrives until it is joined again. */
export function ensureRoom(roomId: string) {
  if (!supabase) return;
  const st = (room(roomId).ch as { state?: string }).state;
  if (st === "closed" || st === "errored") { try { room(roomId).ch.subscribe(); } catch { /* it retries on its own */ } }
}

/** Be told when someone types in this room. Returns a function that stops listening. */
export function onTyping(roomId: string, cb: TypingCb): () => void {
  if (!supabase) return () => undefined;
  const r = room(roomId);
  r.typing.add(cb);
  return () => { r.typing.delete(cb); };
}

/** Say "I have this conversation open" and be told whether the other person does too. Only while this is called and not stopped; it is never stored.
 *  `onChange` gets the ids of everyone else who is here. Returns the function that stops. */
export function watchHere(roomId: string, me: string, onChange: (others: Set<string>) => void): () => void {
  if (!supabase) return () => undefined;
  const r = room(roomId);
  const cb = (ids: Set<string>) => { const others = new Set(ids); others.delete(me); onChange(others); };
  r.here.add(cb);
  let stopped = false;
  let tries = 0;
  const join = () => {
    if (stopped) return;
    if ((r.ch as { state?: string }).state === "joined") { void Promise.resolve(r.ch.track({ u: me })).catch(() => undefined); return; }
    if (++tries < 12) window.setTimeout(join, 700);
  };
  join();
  return () => { stopped = true; r.here.delete(cb); try { void Promise.resolve(r.ch.untrack()).catch(() => undefined); } catch { /* closing anyway */ } };
}
