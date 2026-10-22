import { supabase } from "./supabase";
import { loadNames, makeLabeler } from "./people";

/** Notifications from the database: likes, comments, replies, messages, friend requests, and being added to a group. */
export type RawNotif = { id: number; actor_id: string | null; kind: string; post_id: string | null; conversation_id: string | null; body: string; read_at: string | null; created_at: string };
export type Notif = { id: number; kind: string; actorId: string | null; actor: string; title: string; sub?: string; to: string; unread: boolean; at: string };

/** Pure: what a notification says and where tapping it goes. The database writes the wording after the person's name ("replied to your comment"). */
export function describe(n: RawNotif, actor: string): Pick<Notif, "title" | "sub" | "to"> {
  switch (n.kind) {
    case "message": return { title: `${actor} sent you a message`, sub: n.body || undefined, to: "/app/messages" };
    case "friend_request": return { title: `${actor} wants to be your friend`, to: n.actor_id ? `/app/people/${n.actor_id}` : "/app/groups" };
    case "friend_accept": return { title: `${actor} accepted your friend request`, to: n.actor_id ? `/app/people/${n.actor_id}` : "/app/groups" };
    case "group_add": return { title: `${actor} ${n.body || "added you to a group"}`, to: "/app/groups" };
    case "like": case "comment": case "reply": return { title: `${actor} ${n.body}`, to: "/app/feed" };
    default: return { title: n.body ? `${actor} ${n.body}` : "Something new", to: "/app/feed" };
  }
}

/** Pure: rows in, notifications out, newest first. */
export function buildNotifs(rows: RawNotif[], me: string, names: Record<string, string>): Notif[] {
  const label = makeLabeler(me, rows.map((r) => r.actor_id).filter((x): x is string => !!x), names, () => "Someone");
  return [...rows]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((r) => {
      const actor = r.actor_id ? label(r.actor_id) : "Someone";
      return { id: r.id, kind: r.kind, actorId: r.actor_id, actor, ...describe(r, actor), unread: !r.read_at, at: r.created_at };
    });
}

export async function loadNotifs(me: string): Promise<Notif[]> {
  const { data, error } = await supabase!.from("notifications").select("id,actor_id,kind,post_id,conversation_id,body,read_at,created_at").order("created_at", { ascending: false }).limit(40);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as RawNotif[];
  const names = await loadNames(rows.map((r) => r.actor_id).filter((x): x is string => !!x));
  return buildNotifs(rows, me, names);
}
