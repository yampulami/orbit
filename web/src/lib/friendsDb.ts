import { supabase } from "./supabase";
import { makeLabeler } from "./people";

/** Friends and friend requests in the database, turned into the lists the screens show. */
export type RawRequest = { id: string; from_user: string; to_user: string; status: "pending" | "accepted" | "declined"; created_at: string };
export type RawFriendship = { user_low: string; user_high: string };
export type RawProfileLite = { user_id: string; display_name: string; username: string | null };
export type RawFriends = { me: string; requests: RawRequest[]; friendships: RawFriendship[]; profiles: RawProfileLite[] };

export type Person = { id: string; name: string; username: string | null };
export type Incoming = { id: string; from: Person; at: string };
export type Outgoing = { id: string; to: Person; at: string };
export type FriendsState = { friends: Person[]; incoming: Incoming[]; outgoing: Outgoing[] };
export type Relation = "self" | "friends" | "incoming" | "outgoing" | "none";

/** Pure: rows in, lists out. Two people with the same display name get a short suffix, so they can be told apart (their username always can). */
export function buildFriends(raw: RawFriends): FriendsState {
  const other = (a: string, b: string) => (a === raw.me ? b : a);
  const ids = [
    ...raw.friendships.map((f) => other(f.user_low, f.user_high)),
    ...raw.requests.map((r) => other(r.from_user, r.to_user)),
  ];
  const byId = new Map(raw.profiles.map((p) => [p.user_id, p]));
  const label = makeLabeler(raw.me, ids, Object.fromEntries(raw.profiles.map((p) => [p.user_id, p.display_name])));
  const person = (id: string): Person => ({ id, name: label(id), username: byId.get(id)?.username ?? null });

  const friends = raw.friendships.map((f) => person(other(f.user_low, f.user_high))).sort((a, b) => a.name.localeCompare(b.name));
  const pending = raw.requests.filter((r) => r.status === "pending");
  const incoming = pending.filter((r) => r.to_user === raw.me).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((r) => ({ id: r.id, from: person(r.from_user), at: r.created_at }));
  const outgoing = pending.filter((r) => r.from_user === raw.me).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((r) => ({ id: r.id, to: person(r.to_user), at: r.created_at }));
  return { friends, incoming, outgoing };
}

/** How you stand with another student, for the button on their profile. */
export function relationTo(state: FriendsState, me: string, otherId: string): { relation: Relation; requestId?: string } {
  if (otherId === me) return { relation: "self" };
  if (state.friends.some((f) => f.id === otherId)) return { relation: "friends" };
  const asked = state.incoming.find((r) => r.from.id === otherId);
  if (asked) return { relation: "incoming", requestId: asked.id };
  if (state.outgoing.some((r) => r.to.id === otherId)) return { relation: "outgoing" };
  return { relation: "none" };
}

export async function loadFriends(me: string): Promise<RawFriends> {
  const sb = supabase!;
  const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };
  const [rq, fr] = await Promise.all([
    sb.from("friend_requests").select("id,from_user,to_user,status,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(200),
    sb.from("friendships").select("user_low,user_high").limit(500),
  ]);
  fail(rq.error); fail(fr.error);
  const requests = (rq.data ?? []) as RawRequest[], friendships = (fr.data ?? []) as RawFriendship[];
  const ids = [...new Set([...requests.flatMap((r) => [r.from_user, r.to_user]), ...friendships.flatMap((f) => [f.user_low, f.user_high])].filter((x) => x !== me))];
  let profiles: RawProfileLite[] = [];
  if (ids.length) {
    const p = await sb.from("student_profiles").select("user_id,display_name,username").in("user_id", ids);
    fail(p.error);
    profiles = (p.data ?? []) as RawProfileLite[];
  }
  return { me, requests, friendships, profiles };
}
