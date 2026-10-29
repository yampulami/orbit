import { supabase } from "./supabase";
import { type HangState, type Rsvp } from "./hangTypes";
import { loadNames, makeLabeler, watchTables, type ChangeEvent } from "./people";

/** Groups, chat, hangouts and answers in the database. The rows are turned into the same shapes the screens already use (people are shown by
 *  display name, and the signed-in student is "You"), so nothing on screen has to know where the data lives. */
export type RawGroup = { id: string; name: string; created_by?: string };
export type RawMember = { group_id: string; user_id: string };
export type RawCode = { group_id: string; code: string };
export type RawMessage = { id: string; group_id: string; sender_id: string; sender_name: string; body: string; hangout_id: string | null; created_at: string };
export type RawHangout = { id: string; group_id: string | null; visibility: "group" | "campus"; created_by: string; title: string; place_name: string; starts_at: string; duration_minutes: number; canceled_at: string | null };
export type RawRsvp = { hangout_id: string; user_id: string; answer: Rsvp };
export type Raw = {
  me: string;
  groups: RawGroup[]; members: RawMember[]; codes: RawCode[]; messages: RawMessage[]; hangouts: RawHangout[]; rsvps: RawRsvp[];
  /** user id to display name */
  names: Record<string, string>;
};

/** Pure: rows in, screen state out. Two different people with the same display name get a short suffix so they stay apart. */
export function labelerFor(raw: Raw) {
  const ids = [...raw.members.map((m) => m.user_id), ...raw.rsvps.map((r) => r.user_id), ...raw.hangouts.map((h) => h.created_by), ...raw.messages.map((m) => m.sender_id)];
  const known = new Set([raw.me, ...ids]);
  const label = makeLabeler(raw.me, ids, raw.names, (id) => raw.messages.find((m) => m.sender_id === id)?.sender_name);
  /** The name shown for this person, or undefined if they are not one of the people already on screen. */
  return (id: string) => (known.has(id) ? label(id) : undefined);
}

export function buildState(raw: Raw): HangState {
  const labelOrUndefined = labelerFor(raw);
  const label = (id: string) => labelOrUndefined(id) ?? "Student";

  const groups = raw.groups.map((g) => {
    const mine = raw.members.filter((m) => m.group_id === g.id).map((m) => m.user_id);
    const members = [...new Set(mine)].sort((a, b) => (a === raw.me ? -1 : b === raw.me ? 1 : label(a).localeCompare(label(b)))).map(label);
    const messages = raw.messages
      .filter((m) => m.group_id === g.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((m) => (m.hangout_id
        ? { id: m.id, author: label(m.sender_id), hangoutId: m.hangout_id, at: m.created_at }
        : { id: m.id, author: label(m.sender_id), text: m.body, at: m.created_at }));
    return { id: g.id, name: g.name, members, messages, code: raw.codes.find((c) => c.group_id === g.id)?.code, mine: g.created_by === raw.me };
  });

  const hangouts = raw.hangouts.map((h) => {
    const rsvps: Record<string, Rsvp> = {};
    raw.rsvps.filter((r) => r.hangout_id === h.id).forEach((r) => { rsvps[label(r.user_id)] = r.answer; });
    return {
      id: h.id, groupId: h.group_id ?? "", title: h.title, place: h.place_name, when: h.starts_at, by: label(h.created_by),
      rsvps, canceled: !!h.canceled_at, visibility: h.visibility, len: h.duration_minutes,
    };
  });
  return { groups, hangouts };
}

const unique = <T,>(l: T[]) => [...new Set(l)];

/** Everything the signed-in student can see: their groups (and the people, chat and codes in them) and the hangouts they may see. */
export async function loadRaw(me: string): Promise<Raw> {
  const sb = supabase!;
  const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };

  const mem = await sb.from("campus_group_memberships").select("group_id,user_id");
  fail(mem.error);
  const members = (mem.data ?? []) as RawMember[];
  const groupIds = unique(members.map((m) => m.group_id));
  const none = Promise.resolve({ data: [] as never[], error: null });

  const [groups, codes, messages, hangouts] = await Promise.all([
    groupIds.length ? sb.from("campus_groups").select("id,name,created_by").in("id", groupIds) : none,
    groupIds.length ? sb.from("group_invites").select("group_id,code").in("group_id", groupIds) : none,
    groupIds.length ? sb.from("group_messages").select("id,group_id,sender_id,sender_name,body,hangout_id,created_at").in("group_id", groupIds).order("created_at", { ascending: true }).limit(1000) : none,
    sb.from("campus_hangouts").select("id,group_id,visibility,created_by,title,place_name,starts_at,duration_minutes,canceled_at").order("starts_at", { ascending: true }).limit(500),
  ]);
  [groups, codes, messages, hangouts].forEach((r) => fail(r.error));
  const hangs = (hangouts.data ?? []) as RawHangout[];

  const rs = hangs.length ? await sb.from("campus_hangout_rsvps").select("hangout_id,user_id,answer").in("hangout_id", hangs.map((h) => h.id)) : { data: [] as never[], error: null };
  fail(rs.error);
  const rsvps = (rs.data ?? []) as RawRsvp[];
  const msgs = (messages.data ?? []) as RawMessage[];

  const userIds = unique([...members.map((m) => m.user_id), ...rsvps.map((r) => r.user_id), ...hangs.map((h) => h.created_by), ...msgs.map((m) => m.sender_id)]);
  const names = await loadNames(userIds);

  return { me, groups: (groups.data ?? []) as RawGroup[], members, codes: (codes.data ?? []) as RawCode[], messages: msgs, hangouts: hangs, rsvps, names };
}

/** Pure: one change from the database applied to what is on screen: a new chat message, a hangout made or changed or removed, or someone's answer.
 *  Returns the new state, or null when it cannot be shown on its own (a group, hangout or person not known yet), in which case the caller looks
 *  everything up again. */
export function applyHangChange(state: HangState, nameOf: (id: string) => string | undefined, e: ChangeEvent): HangState | null {
  if (e.table === "group_messages") {
    if (e.type !== "INSERT") return null;
    const m = e.row as unknown as RawMessage;
    if (!m.id || !m.group_id) return null;
    const g = state.groups.find((x) => x.id === m.group_id);
    const author = nameOf(m.sender_id);
    if (!g || author === undefined) return null;
    if (g.messages.some((x) => x.id === m.id)) return state; // already there: it is your own message, shown the moment you sent it
    const message = m.hangout_id ? { id: m.id, author, hangoutId: m.hangout_id, at: m.created_at } : { id: m.id, author, text: m.body, at: m.created_at };
    return { ...state, groups: state.groups.map((x) => (x.id === g.id ? { ...x, messages: [...x.messages, message] } : x)) };
  }

  if (e.table === "campus_hangouts") {
    if (e.type === "DELETE") {
      const id = e.old.id as string | undefined;
      return id ? { ...state, hangouts: state.hangouts.filter((h) => h.id !== id) } : null;
    }
    const r = e.row as unknown as RawHangout;
    const by = nameOf(r.created_by);
    if (!r.id || by === undefined) return null;
    const before = state.hangouts.find((h) => h.id === r.id);
    const next = { id: r.id, groupId: r.group_id ?? "", title: r.title, place: r.place_name, when: r.starts_at, by, rsvps: before?.rsvps ?? {}, canceled: !!r.canceled_at, visibility: r.visibility, len: r.duration_minutes };
    const list = before ? state.hangouts.map((h) => (h.id === r.id ? next : h)) : [...state.hangouts, next];
    return { ...state, hangouts: list.sort((a, b) => a.when.localeCompare(b.when)) };
  }

  if (e.table === "campus_hangout_rsvps") {
    const r = (e.type === "DELETE" ? e.old : e.row) as { hangout_id?: string; user_id?: string; answer?: Rsvp };
    if (!r.hangout_id || !r.user_id) return null;
    const h = state.hangouts.find((x) => x.id === r.hangout_id);
    const who = nameOf(r.user_id);
    if (!h || who === undefined) return null;
    const rsvps = { ...h.rsvps };
    if (e.type === "DELETE") delete rsvps[who]; else if (r.answer) rsvps[who] = r.answer; else return null;
    return { ...state, hangouts: state.hangouts.map((x) => (x.id === h.id ? { ...x, rsvps } : x)) };
  }
  return null;
}

/** Reload whenever anything relevant changes. The data is small, so reloading is simpler and safer than patching it piece by piece. */
export const watch = (me: string, onChange: () => void, onEvent?: (e: ChangeEvent) => boolean, probe?: () => Promise<boolean>) => watchTables(`orbit-hang-${me}`, ["group_messages", "campus_hangouts", "campus_hangout_rsvps", "campus_group_memberships"], onChange, onEvent, probe);
