import { supabase } from "./supabase";
import { loadNames, makeLabeler, type ChangeEvent } from "./people";

/** Direct messages in the database: one conversation per pair of students on a campus, with its messages. The rows become threads for the screen. */
export type RawConv = { id: string; user_low: string; user_high: string; updated_at: string };
export type RawDm = { id: string; conversation_id: string; sender_id: string; body: string; read_at: string | null; created_at: string };
export type RawDms = { me: string; conversations: RawConv[]; messages: RawDm[]; names: Record<string, string> };

export type DmMessage = { id: string; mine: boolean; text: string; at: string };
export type DmThread = { id: string; otherId: string; name: string; messages: DmMessage[]; unread: number; updatedAt: string };
export type Person = { id: string; name: string };

/** Pure: rows in, threads out. Newest conversation first; messages oldest first. A message from the other person that has no read time is unread. */
export function buildThreads(raw: RawDms): DmThread[] {
  const others = raw.conversations.map((c) => (c.user_low === raw.me ? c.user_high : c.user_low));
  const label = makeLabeler(raw.me, others, raw.names);
  return [...raw.conversations]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .map((c) => {
      const otherId = c.user_low === raw.me ? c.user_high : c.user_low;
      const messages = raw.messages
        .filter((m) => m.conversation_id === c.id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((m) => ({ id: m.id, mine: m.sender_id === raw.me, text: m.body, at: m.created_at }));
      const unread = raw.messages.filter((m) => m.conversation_id === c.id && m.sender_id !== raw.me && !m.read_at).length;
      return { id: c.id, otherId, name: label(otherId), messages, unread, updatedAt: c.updated_at };
    });
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
    if (e.type === "UPDATE") return threads; // read marks are kept on this device when you open a chat
    if (t.messages.some((x) => x.id === m.id)) return threads; // your own message, already shown
    const mine = m.sender_id === me;
    const next = { ...t, messages: [...t.messages, { id: m.id, mine, text: m.body, at: m.created_at }], unread: t.unread + (!mine && !m.read_at ? 1 : 0), updatedAt: m.created_at > t.updatedAt ? m.created_at : t.updatedAt };
    return threads.map((x) => (x.id === t.id ? next : x)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  if (e.table === "direct_conversations" && e.type === "UPDATE") {
    const c = e.row as unknown as RawConv;
    const t = threads.find((x) => x.id === c.id);
    if (!t) return null;
    return threads.map((x) => (x.id === t.id && c.updated_at > x.updatedAt ? { ...x, updatedAt: c.updated_at } : x)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  return null;
}

/** The ordering the database requires for a pair: the lower id is stored first. */
export const pairOf = (a: string, b: string) => (a < b ? { user_low: a, user_high: b } : { user_low: b, user_high: a });

export async function loadDms(me: string): Promise<RawDms> {
  const sb = supabase!;
  const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };
  const c = await sb.from("direct_conversations").select("id,user_low,user_high,updated_at").order("updated_at", { ascending: false }).limit(200);
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
