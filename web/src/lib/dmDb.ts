import { supabase } from "./supabase";
import { loadNames, makeLabeler, type ChangeEvent } from "./people";

/** Direct messages in the database: one conversation per pair of students on a campus, with its messages. The rows become threads for the screen. */
export type RawConv = { id: string; user_low: string; user_high: string; updated_at: string; /** 'pending' is a message request; before the database knows about requests this is missing, which means a normal chat. */ status?: string; initiator_id?: string | null };
export type RawDm = { id: string; conversation_id: string; sender_id: string; body: string; read_at: string | null; created_at: string };
export type RawDms = { me: string; conversations: RawConv[]; messages: RawDm[]; names: Record<string, string> };

export type DmMessage = { id: string; mine: boolean; text: string; at: string; /** When the other person opened it (only set for your own messages). */ seenAt?: string };
/** `incoming`: someone who is not your friend wrote to you first. It waits in Requests until you accept or delete it.
 *  `waiting`: you wrote first to someone who is not your friend, and they have not answered yet. `sent` is how many of your messages are in it. */
export type DmThread = { id: string; otherId: string; name: string; messages: DmMessage[]; unread: number; updatedAt: string; incoming?: boolean; waiting?: boolean; sent?: number };
/** How many messages a stranger may send before the other person answers. The database enforces the same number. */
export const REQUEST_LIMIT = 3;
export type Person = { id: string; name: string };

/** Pure: rows in, threads out. Newest conversation first; messages oldest first. A message from the other person that has no read time is unread. */
export function buildThreads(raw: RawDms): DmThread[] {
  const others = raw.conversations.map((c) => (c.user_low === raw.me ? c.user_high : c.user_low));
  const label = makeLabeler(raw.me, others, raw.names);
  return [...raw.conversations]
    // A request you deleted is gone for you. (The sender is never told, and their own copy stays on their side.)
    .filter((c) => !(c.status === "declined" && c.initiator_id && c.initiator_id !== raw.me))
    .sort((a, b) => when(b.updated_at) - when(a.updated_at))
    .map((c) => {
      const otherId = c.user_low === raw.me ? c.user_high : c.user_low;
      const messages = raw.messages
        .filter((m) => m.conversation_id === c.id)
        .sort((a, b) => when(a.created_at) - when(b.created_at))
        .map((m) => ({ id: m.id, mine: m.sender_id === raw.me, text: m.body, at: m.created_at, ...(m.sender_id === raw.me && m.read_at ? { seenAt: m.read_at } : {}) }));
      const unread = raw.messages.filter((m) => m.conversation_id === c.id && m.sender_id !== raw.me && !m.read_at).length;
      const request = (c.status === "pending" || c.status === "declined") && !!c.initiator_id;
      const incoming = request && c.initiator_id !== raw.me;
      const waiting = request && c.initiator_id === raw.me;
      return { id: c.id, otherId, name: label(otherId), messages, unread, updatedAt: c.updated_at, ...(incoming ? { incoming } : {}), ...(waiting ? { waiting, sent: messages.filter((m) => m.mine).length } : {}) };
    });
}

const when = (iso: string) => { const n = Date.parse(iso); return Number.isNaN(n) ? 0 : n; };

/** When a conversation last had anything happen, as a time: its stored time, or its newest message if that is later. Compared as times, not as text,
 *  because the database writes "+00:00" and the phone writes "Z", and the two do not sort the same as text. */
export const recency = (t: DmThread): number => Math.max(when(t.updatedAt), when(t.messages[t.messages.length - 1]?.at ?? ""));

/** Pure: the conversation with the newest activity first. */
export const byRecent = (threads: DmThread[]): DmThread[] => [...threads].sort((a, b) => recency(b) - recency(a));

/** Pure: you sent a message. It shows in its conversation at once, and that conversation moves to the top of the list. (A phone clock a little behind
 *  the server must not leave it below a conversation that is really older, so it is placed just ahead of whatever is on top.) */
export function addSent(threads: DmThread[], threadId: string, msg: { id: string; text: string; at: string }): DmThread[] {
  const t = threads.find((x) => x.id === threadId);
  if (!t) return threads;
  const top = threads.reduce((m, x) => Math.max(m, recency(x)), 0);
  const updatedAt = new Date(Math.max(when(msg.at), top + 1)).toISOString();
  const next: DmThread = { ...t, messages: [...t.messages, { id: msg.id, mine: true, text: msg.text, at: msg.at }], updatedAt, ...(t.waiting ? { sent: (t.sent ?? 0) + 1 } : {}) };
  return byRecent(threads.map((x) => (x.id === threadId ? next : x)));
}

/** Pure: one change from the database applied to the threads on screen. Returns null when it cannot be applied on its own
 *  (a conversation that is not here yet), in which case the caller looks everything up again. */
export function applyDmChange(threads: DmThread[], me: string, e: ChangeEvent): DmThread[] | null {
  if (e.table === "direct_messages") {
    if (e.type === "DELETE") {
      const id = e.old.id as string | undefined;
      return id ? threads.map((t) => (t.messages.some((m) => m.id === id) ? { ...t, messages: t.messages.filter((m) => m.id !== id) } : t)) : null;
    }
    const m = e.row as unknown as RawDm;
    const t = threads.find((x) => x.id === m.conversation_id);
    if (!t) return null;
    if (e.type === "UPDATE") {
      // The other person opened your message: it now says Seen. (Your own read marks are kept on this device when you open a chat.)
      if (m.sender_id !== me || !m.read_at) return threads;
      return threads.map((x) => (x.id === t.id ? { ...x, messages: x.messages.map((y) => (y.id === m.id && !y.seenAt ? { ...y, seenAt: m.read_at as string } : y)) } : x));
    }
    if (t.messages.some((x) => x.id === m.id)) return threads; // your own message, already shown
    const mine = m.sender_id === me;
    const next = { ...t, ...(t.waiting && mine ? { sent: (t.sent ?? 0) + 1 } : {}), messages: [...t.messages, { id: m.id, mine, text: m.body, at: m.created_at, ...(mine && m.read_at ? { seenAt: m.read_at } : {}) }], unread: t.unread + (!mine && !m.read_at ? 1 : 0), updatedAt: when(m.created_at) > when(t.updatedAt) ? m.created_at : t.updatedAt };
    return byRecent(threads.map((x) => (x.id === t.id ? next : x)));
  }
  if (e.table === "direct_conversations" && e.type === "UPDATE") {
    const c = e.row as unknown as RawConv;
    const t = threads.find((x) => x.id === c.id);
    if (!t) return null;
    // A request was accepted or deleted: the groups on screen change, so look everything up again.
    if (c.status !== undefined && (c.status === "accepted") !== (!t.incoming && !t.waiting)) return null;
    if (c.status === "declined") return null;
    return byRecent(threads.map((x) => (x.id === t.id && when(c.updated_at) > when(x.updatedAt) ? { ...x, updatedAt: c.updated_at } : x)));
  }
  return null;
}

/** The ordering the database requires for a pair: the lower id is stored first. */
export const pairOf = (a: string, b: string) => (a < b ? { user_low: a, user_high: b } : { user_low: b, user_high: a });

export async function loadDms(me: string): Promise<RawDms> {
  const sb = supabase!;
  const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };
  // "*" so that status and initiator_id come along once the database has them, and nothing breaks before it does.
  const c = await sb.from("direct_conversations").select("*").order("updated_at", { ascending: false }).limit(200);
  fail(c.error);
  const conversations = (c.data ?? []) as RawConv[];
  const m = conversations.length
    ? await sb.from("direct_messages").select("id,conversation_id,sender_id,body,read_at,created_at").in("conversation_id", conversations.map((x) => x.id)).order("created_at", { ascending: true }).limit(3000)
    : { data: [] as never[], error: null };
  fail(m.error);
  const names = await loadNames(conversations.map((x) => (x.user_low === me ? x.user_high : x.user_low)));
  return { me, conversations, messages: (m.data ?? []) as RawDm[], names };
}

/** Other students on the same campus, for starting a conversation. The rules only return your own campus. */
export async function loadPeople(me: string): Promise<Person[]> {
  const { data, error } = await supabase!.from("student_profiles").select("user_id,display_name").neq("user_id", me).order("display_name", { ascending: true }).limit(300);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { user_id: string; display_name: string }[];
  const label = makeLabeler(me, rows.map((r) => r.user_id), Object.fromEntries(rows.map((r) => [r.user_id, r.display_name])));
  return rows.map((r) => ({ id: r.user_id, name: label(r.user_id) }));
}
