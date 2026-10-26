import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { dbRun, refreshOnReturn } from "./privateDb";
import { staleLimiter, watchTables } from "./people";
import { fetchChange, listenRooms, sendNudge, type Nudge } from "./nudge";
import { notice } from "./notice";
import { applyDmChange, buildThreads, loadDms, loadPeople, pairOf, type DmThread, type Person } from "./dmDb";

/** Direct messages with students on your campus. With a database they arrive live; without one (demo mode) the Messages page shows a sample. */
type State = { threads: DmThread[]; people: Person[]; status: "idle" | "loading" | "ready" | "error" };
export const dmLive = !!supabase;

let state: State = { threads: [], people: [], status: "idle" };
const subs = new Set<() => void>();
function set(next: State) { state = next; subs.forEach((f) => f()); }

let who: string | null = null;
let stop: (() => void) | null = null;
let stopReturn: (() => void) | null = null;
let loadId = 0;
const reading = new Set<string>();
const limit = staleLimiter();
let epoch = 0; // counts changes applied straight from the live connection

async function reload() {
  if (!who) return;
  const me = who, mine = ++loadId, e0 = epoch;
  try {
    const threads = buildThreads(await loadDms(me));
    if (mine !== loadId || who !== me) return;
    if (epoch !== e0) { void reload(); return; } // a message arrived while this was loading: this answer may be older than it
    set({ ...state, threads, status: "ready" });
    listenRooms("dms", [...threads.map((t) => t.id), `inbox-${me}`], onNudge); // the inbox is how a brand new conversation reaches you
  } catch {
    if (mine === loadId && who === me) set({ ...state, status: "error" });
  }
}

/** The other person sent a message: show it now, ahead of the database's own change feed. */
async function onNudge(n: Nudge) {
  if (n.table !== "direct_messages" || n.op !== "upsert" || !who) return;
  const change = await fetchChange(n.table, n.id).catch(() => null);
  if (!change) return;
  const next = applyDmChange(state.threads, who, change);
  if (next) { epoch++; if (next !== state.threads) set({ ...state, threads: next }); } else void reload();
}

export function bindDms(userId: string) {
  if (!dmLive || who === userId) return;
  unbindDms();
  who = userId;
  set({ threads: [], people: [], status: "loading" });
  void reload();
  loadPeople(userId).then((people) => { if (who === userId) set({ ...state, people }); }).catch(() => undefined);
  stop = watchTables(`orbit-dm-${userId}`, ["direct_messages", "direct_conversations"], () => void reload(), (e) => {
    // A new message shows at once, without fetching every conversation again.
    const next = applyDmChange(state.threads, userId, e);
    if (!next) return false;
    epoch++;
    if (next !== state.threads) set({ ...state, threads: next });
    return true;
  }, async () => {
    // Is the newest message in the database one we already show? If not, something was missed (for example the phone slept).
    const { data, error } = await supabase!.from("direct_messages").select("id").order("created_at", { ascending: false }).limit(1);
    const id = (data?.[0] as { id: string } | undefined)?.id;
    return !error && !!id && limit(id, !state.threads.some((t) => t.messages.some((m) => m.id === id)));
  });
  stopReturn = refreshOnReturn(() => void reload());
}
export function unbindDms() {
  if (!dmLive) return;
  stop?.(); stop = null; stopReturn?.(); stopReturn = null;
  who = null; loadId++; reading.clear(); listenRooms("dms", [], onNudge);
  set({ threads: [], people: [], status: "idle" });
}

const patchThread = (id: string, fn: (t: DmThread) => DmThread) => set({ ...state, threads: state.threads.map((t) => (t.id === id ? fn(t) : t)) });

export const dmActions = {
  /** Send a message. It shows at once and is saved in the background; if saving fails you are told and the real list comes back. */
  send(threadId: string, text: string) {
    const body = text.trim().slice(0, 2000);
    if (!body || !who) return;
    const me = who, id = crypto.randomUUID(), at = new Date().toISOString();
    patchThread(threadId, (t) => ({ ...t, messages: [...t.messages, { id, mine: true, text: body, at }], updatedAt: at }));
    dbRun("Sending that message", () => supabase!.from("direct_messages").insert({ id, conversation_id: threadId, sender_id: me, body }), () => void reload(), () => {
      const note = { table: "direct_messages", id, op: "upsert" } as const;
      sendNudge(threadId, note);
      const other = state.threads.find((t) => t.id === threadId)?.otherId;
      if (other) sendNudge(`inbox-${other}`, note);
    });
  },

  /** Open the conversation with this person, making it if it does not exist yet. Resolves to its id, or null if it could not be made. */
  async start(otherId: string): Promise<string | null> {
    if (!who) return null;
    const existing = state.threads.find((t) => t.otherId === otherId);
    if (existing) return existing.id;
    const me = who, id = crypto.randomUUID();
    // The database keeps each pair in one fixed order; if our guess at the order is refused, try the other.
    let { error } = await supabase!.from("direct_conversations").insert({ id, campus_key: await campusKey(), ...pairOf(me, otherId) });
    if (error && /check|violates/i.test(error.message) && !/row-level/i.test(error.message)) {
      ({ error } = await supabase!.from("direct_conversations").insert({ id, campus_key: await campusKey(), user_low: otherId, user_high: me }));
    }
    if (error) {
      const found = await supabase!.from("direct_conversations").select("id").or(`and(user_low.eq.${me},user_high.eq.${otherId}),and(user_low.eq.${otherId},user_high.eq.${me})`).limit(1);
      const there = (found.data ?? [])[0] as { id: string } | undefined;
      if (there) { await reload(); return there.id; }
      notice.show({ icon: "alert", title: "That chat did not start", message: error.message });
      return null;
    }
    await reload();
    return id;
  },

  /** Mark what the other person sent as read. Safe to call again and again. */
  markRead(threadId: string) {
    const t = state.threads.find((x) => x.id === threadId);
    if (!t || !t.unread || !who || reading.has(threadId)) return;
    const me = who;
    reading.add(threadId);
    patchThread(threadId, (x) => ({ ...x, unread: 0 }));
    Promise.resolve(supabase!.from("direct_messages").update({ read_at: new Date().toISOString() }).eq("conversation_id", threadId).neq("sender_id", me).is("read_at", null))
      .then(() => undefined, () => undefined)
      .then(() => { reading.delete(threadId); });
  },
};

async function campusKey(): Promise<string> {
  const { data, error } = await supabase!.from("campus_memberships").select("campus_key").limit(1);
  if (error || !data?.[0]) throw new Error("Join a campus first.");
  return (data[0] as { campus_key: string }).campus_key;
}

export const useDms = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
export const unreadDms = (threads: DmThread[]) => threads.reduce((n, t) => n + t.unread, 0);
