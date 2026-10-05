import { auth } from "./authClient";
import { campusKey, validCampus } from "../../src/campus";
import { joinCampus } from "./campusFeed";

export type CampusGroup = {
  id: string;
  name: string;
  description: string;
  joined: boolean;
  createdAt: string;
};

export type GroupMessage = {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  mine: boolean;
  body: string;
  createdAt: string;
};

function client() {
  if (!auth) throw new Error("Orbit messages are not connected.");
  return auth;
}

function detail(error: unknown) {
  const value = error as { code?: string; message?: string } | null;
  if (/network|fetch|gateway|timeout/i.test(value?.message ?? ""))
    return "Messages couldn’t connect. Check your connection and try again.";
  return value?.message || "Messages couldn’t be updated.";
}

async function ensureCampusLounge(campus: string, me: string) {
  const key = campusKey(campus);
  let { data: group, error } = await client()
    .from("campus_groups")
    .select("id,name,description,created_at")
    .eq("campus_key", key)
    .eq("name", "Campus Lounge")
    .maybeSingle();
  if (error) throw new Error(detail(error));
  if (!group) {
    const created = await client()
      .from("campus_groups")
      .insert({
        campus_key: key,
        name: "Campus Lounge",
        description: `The shared conversation for ${campus.trim()}.`,
        created_by: me,
      })
      .select("id,name,description,created_at")
      .single();
    if (created.error?.code === "23505") {
      const retry = await client()
        .from("campus_groups")
        .select("id,name,description,created_at")
        .eq("campus_key", key)
        .eq("name", "Campus Lounge")
        .single();
      group = retry.data;
      error = retry.error;
    } else {
      group = created.data;
      error = created.error;
    }
    if (error || !group) throw new Error(detail(error));
  }
  const joined = await client()
    .from("campus_group_memberships")
    .upsert({ group_id: group.id, user_id: me });
  if (joined.error) throw new Error(detail(joined.error));
  return group.id as string;
}

export async function fetchCampusGroups(campus: string) {
  if (!validCampus(campus)) throw new Error("Add your university in your profile to use messages.");
  const me = await joinCampus(campus);
  await ensureCampusLounge(campus, me);
  const [groups, memberships] = await Promise.all([
    client().from("campus_groups").select("id,name,description,created_at").eq("campus_key", campusKey(campus)).order("created_at"),
    client().from("campus_group_memberships").select("group_id").eq("user_id", me),
  ]);
  if (groups.error) throw new Error(detail(groups.error));
  if (memberships.error) throw new Error(detail(memberships.error));
  const joined = new Set((memberships.data ?? []).map((row) => row.group_id));
  return (groups.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    joined: joined.has(row.id),
    createdAt: row.created_at,
  })) satisfies CampusGroup[];
}

export async function createCampusGroup(campus: string, name: string, description: string) {
  const trimmed = name.trim();
  if (trimmed.length < 2) throw new Error("Give the group a name.");
  if (trimmed.length > 100 || description.trim().length > 500)
    throw new Error("Keep the name under 100 characters and description under 500.");
  const me = await joinCampus(campus);
  const created = await client()
    .from("campus_groups")
    .insert({ campus_key: campusKey(campus), name: trimmed, description: description.trim(), created_by: me })
    .select("id")
    .single();
  if (created.error) throw new Error(created.error.code === "23505" ? "A group with that name already exists." : detail(created.error));
  const member = await client().from("campus_group_memberships").insert({ group_id: created.data.id, user_id: me });
  if (member.error) throw new Error(detail(member.error));
  return created.data.id as string;
}

export async function joinCampusGroup(groupId: string) {
  const { data, error } = await client().auth.getUser();
  if (error || !data.user) throw new Error("Sign in to join this group.");
  const result = await client().from("campus_group_memberships").upsert({ group_id: groupId, user_id: data.user.id });
  if (result.error) throw new Error(detail(result.error));
}

export async function fetchGroupMessages(groupId: string) {
  const { data: user } = await client().auth.getUser();
  const result = await client()
    .from("group_messages")
    .select("id,group_id,sender_id,sender_name,body,created_at")
    .eq("group_id", groupId)
    .order("created_at")
    .limit(200);
  if (result.error) throw new Error(detail(result.error));
  return (result.data ?? []).map((row) => ({
    id: row.id,
    groupId: row.group_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    mine: row.sender_id === user.user?.id,
    body: row.body,
    createdAt: row.created_at,
  })) satisfies GroupMessage[];
}

export async function sendGroupMessage(groupId: string, id: string, senderName: string, body: string) {
  const text = body.trim();
  if (!text) return;
  if (text.length > 2000) throw new Error("Keep messages under 2,000 characters.");
  const { data, error } = await client().auth.getUser();
  if (error || !data.user) throw new Error("Sign in to send messages.");
  const sent = await client().from("group_messages").insert({
    id, group_id: groupId, sender_id: data.user.id, sender_name: senderName, body: text,
  });
  if (sent.error) throw new Error(detail(sent.error));
}

export function subscribeCampusMessages(campus: string, refresh: () => void) {
  const supabase = auth;
  if (!supabase || !validCampus(campus)) return () => {};
  const channel = supabase.channel(`campus-messages-${campusKey(campus)}`);
  for (const table of ["campus_groups", "campus_group_memberships", "group_messages"])
    channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
  channel.subscribe();
  return () => { void supabase.removeChannel(channel); };
}
