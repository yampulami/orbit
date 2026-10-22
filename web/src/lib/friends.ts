import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { notice } from "./notice";
import { refreshOnReturn } from "./privateDb";
import { watchTables } from "./people";
import { buildFriends, loadFriends, relationTo, type FriendsState, type Person, type Relation } from "./friendsDb";

/** Friends and friend requests. They exist only with a database: in demo mode there are no other real students to befriend. */
export const friendsLive = !!supabase;

const EMPTY: FriendsState = { friends: [], incoming: [], outgoing: [] };
let state: FriendsState = EMPTY;
const subs = new Set<() => void>();
function set(next: FriendsState) { state = next; subs.forEach((f) => f()); }

let who: string | null = null;
let stop: (() => void) | null = null;
let stopReturn: (() => void) | null = null;
let loadId = 0;

async function reload() {
  if (!who) return;
  const me = who, mine = ++loadId;
  try {
    const next = buildFriends(await loadFriends(me));
    if (mine === loadId && who === me) set(next);
  } catch { /* keep what is on screen */ }
}

export function bindFriends(userId: string) {
  if (!friendsLive || who === userId) return;
  unbindFriends();
  who = userId;
  void reload();
  stop = watchTables(`orbit-friends-${userId}`, ["friend_requests", "friendships"], () => void reload());
  stopReturn = refreshOnReturn(() => void reload());
}
export function unbindFriends() {
  if (!friendsLive) return;
  stop?.(); stop = null; stopReturn?.(); stopReturn = null;
  who = null; loadId++;
  set(EMPTY);
}

/** Run a friends change on the server; say why in plain words if it was refused, and return that message (or null on success). */
async function call(fn: string, args: Record<string, unknown>): Promise<{ message: string | null; data: unknown }> {
  const { data, error } = await supabase!.rpc(fn, args);
  if (error) return { message: /function|schema cache|could not find/i.test(error.message) ? "Friends are not switched on for this project yet." : error.message, data: null };
  await reload();
  return { message: null, data };
}

export const friendActions = {
  /** Ask to be friends. If they had already asked you, you become friends straight away. */
  async request(target: string): Promise<{ message: string | null; becameFriends: boolean }> {
    const r = await call("send_friend_request", { target });
    return { message: r.message, becameFriends: r.data === "friends" };
  },
  async accept(requestId: string) { return (await call("respond_friend_request", { request_id: requestId, accept: true })).message; },
  async ignore(requestId: string) { return (await call("respond_friend_request", { request_id: requestId, accept: false })).message; },
  async cancel(target: string) { return (await call("cancel_friend_request", { target })).message; },
  async remove(other: string) { return (await call("remove_friend", { other })).message; },
  /** Add one of your friends to a group you are in. */
  async addToGroup(groupId: string, friend: string) { return (await call("add_friend_to_group", { gid: groupId, friend })).message; },
  /** Show a refusal as a notice. */
  tell(message: string | null, title = "That did not work") { if (message) notice.show({ icon: "alert", title, message }); return !message; },
};

export const useFriends = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
export const useRelation = (me: string | undefined, otherId: string): { relation: Relation; requestId?: string } => {
  const s = useFriends();
  return me ? relationTo(s, me, otherId) : { relation: "none" };
};
export type { Person, FriendsState };
