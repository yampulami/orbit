import { auth } from "./authClient";
import { campusKey, validCampus } from "../../src/campus";
import type { StudentProfile } from "../../src/studentProfile";
import { joinCampus } from "./campusFeed";

export type CampusProfile = {
  userId: string;
  name: string;
  bio: string;
  lifestyle: string;
  year: string;
  major: string;
  hobbies: string[];
  clubs: string[];
  followers: number;
  following: number;
  followedByMe: boolean;
  blockedByMe: boolean;
};

export type DirectThread = {
  id: string;
  peerId: string;
  peerName: string;
  peerMajor: string;
  updatedAt: string;
  lastMessage?: string;
  unread: number;
};

export type DirectMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  mine: boolean;
  read: boolean;
  createdAt: string;
};

export type OrbitNotification = {
  id: number;
  actorName: string;
  kind: "like" | "comment" | "reply" | "message" | "event";
  body: string;
  postId?: string;
  conversationId?: string;
  read: boolean;
  createdAt: string;
};

function client() {
  if (!auth) throw new Error("Orbit social features are not connected.");
  return auth;
}

function issue(error: unknown) {
  const detail = error as { code?: string; message?: string } | null;
  if (detail?.code === "42P01" || /does not exist|schema cache/i.test(detail?.message ?? ""))
    return "This feature is being set up. Try again shortly.";
  if (/network|fetch|gateway|timeout/i.test(detail?.message ?? ""))
    return "Orbit couldn’t connect. Check your connection and try again.";
  return detail?.message || "Orbit couldn’t complete that request.";
}

async function me() {
  const result = await client().auth.getUser();
  if (result.error || !result.data.user) throw new Error("Sign in to continue.");
  return result.data.user.id;
}

export async function syncCampusProfile(profile: StudentProfile) {
  if (!validCampus(profile.campus)) return;
  const userId = await joinCampus(profile.campus);
  const result = await client().from("student_profiles").upsert({
    user_id: userId,
    campus_key: campusKey(profile.campus),
    display_name: profile.name.trim(),
    bio: profile.bio?.trim() ?? "",
    lifestyle: profile.lifestyle,
    academic_year: profile.year,
    major: profile.major.trim(),
    hobbies: profile.hobbies,
    clubs: profile.clubs,
    updated_at: new Date().toISOString(),
  });
  if (result.error) throw new Error(issue(result.error));
}

export async function fetchCampusProfile(userId: string): Promise<CampusProfile | null> {
  const current = await me();
  const result = await client().from("student_profiles")
    .select("user_id,display_name,bio,lifestyle,academic_year,major,hobbies,clubs")
    .eq("user_id", userId).maybeSingle();
  if (result.error) throw new Error(issue(result.error));
  if (!result.data) return null;
  const [followers, following, relationship, block] = await Promise.all([
    client().from("student_follows").select("follower_id", { count: "exact", head: true }).eq("followed_id", userId),
    client().from("student_follows").select("followed_id", { count: "exact", head: true }).eq("follower_id", userId),
    client().from("student_follows").select("followed_id").eq("follower_id", current).eq("followed_id", userId).maybeSingle(),
    client().from("user_blocks").select("blocked_id").eq("blocker_id", current).eq("blocked_id", userId).maybeSingle(),
  ]);
  for (const query of [followers, following, relationship, block]) if (query.error) throw new Error(issue(query.error));
  return {
    userId: result.data.user_id,
    name: result.data.display_name,
    bio: result.data.bio,
    lifestyle: result.data.lifestyle,
    year: result.data.academic_year,
    major: result.data.major,
    hobbies: result.data.hobbies ?? [],
    clubs: result.data.clubs ?? [],
    followers: followers.count ?? 0,
    following: following.count ?? 0,
    followedByMe: !!relationship.data,
    blockedByMe: !!block.data,
  };
}

export async function setStudentFollow(userId: string, followed: boolean) {
  const current = await me();
  const query = followed
    ? client().from("student_follows").upsert({ follower_id: current, followed_id: userId })
    : client().from("student_follows").delete().eq("follower_id", current).eq("followed_id", userId);
  const result = await query;
  if (result.error) throw new Error(issue(result.error));
}

export async function fetchFollowedIds() {
  const current = await me();
  const result = await client().from("student_follows").select("followed_id").eq("follower_id", current);
  if (result.error) throw new Error(issue(result.error));
  return (result.data ?? []).map((row) => row.followed_id as string);
}

export async function blockStudent(userId: string) {
  const current = await me();
  const result = await client().from("user_blocks").upsert({ blocker_id: current, blocked_id: userId });
  if (result.error) throw new Error(issue(result.error));
}

export async function unblockStudent(userId: string) {
  const current = await me();
  const result = await client().from("user_blocks").delete().eq("blocker_id", current).eq("blocked_id", userId);
  if (result.error) throw new Error(issue(result.error));
}

export type ReportReason = "spam" | "harassment" | "unsafe" | "misinformation" | "other";
export async function reportCampusPost(postId: string, reportedUserId: string | undefined, reason: ReportReason, detail: string) {
  const current = await me();
  const result = await client().from("content_reports").insert({
    reporter_id: current,
    post_id: postId,
    reported_user_id: reportedUserId ?? null,
    reason,
    detail: detail.trim(),
  });
  if (result.error) throw new Error(issue(result.error));
}

export async function openDirectConversation(campus: string, peerId: string) {
  if (!validCampus(campus)) throw new Error("Choose your university before starting a chat.");
  const userId = await joinCampus(campus);
  if (peerId === userId) throw new Error("This is your own post.");
  const [userLow, userHigh] = [userId, peerId].sort();
  const existing = await client().from("direct_conversations").select("id")
    .eq("user_low", userLow).eq("user_high", userHigh).maybeSingle();
  if (existing.error) throw new Error(issue(existing.error));
  if (existing.data) return existing.data.id as string;
  const created = await client().from("direct_conversations").insert({
    campus_key: campusKey(campus), user_low: userLow, user_high: userHigh,
  }).select("id").single();
  if (created.error) {
    if (created.error.code === "23505") {
      const retry = await client().from("direct_conversations").select("id")
        .eq("user_low", userLow).eq("user_high", userHigh).single();
      if (!retry.error) return retry.data.id as string;
    }
    throw new Error(issue(created.error));
  }
  return created.data.id as string;
}

export async function fetchDirectThreads(): Promise<DirectThread[]> {
  const userId = await me();
  const conversations = await client().from("direct_conversations")
    .select("id,user_low,user_high,updated_at")
    .or(`user_low.eq.${userId},user_high.eq.${userId}`)
    .order("updated_at", { ascending: false });
  if (conversations.error) throw new Error(issue(conversations.error));
  const rows = conversations.data ?? [];
  const peerIds = rows.map((row) => row.user_low === userId ? row.user_high : row.user_low);
  const ids = rows.map((row) => row.id);
  const [profiles, recent] = await Promise.all([
    peerIds.length ? client().from("student_profiles").select("user_id,display_name,major").in("user_id", peerIds) : Promise.resolve({ data: [], error: null }),
    ids.length ? client().from("direct_messages").select("id,conversation_id,sender_id,body,read_at,created_at").in("conversation_id", ids).order("created_at", { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null }),
  ]);
  if (profiles.error) throw new Error(issue(profiles.error));
  if (recent.error) throw new Error(issue(recent.error));
  const profileMap = new Map((profiles.data ?? []).map((row) => [row.user_id, row]));
  return rows.map((row) => {
    const peerId = row.user_low === userId ? row.user_high : row.user_low;
    const profile = profileMap.get(peerId);
    const messages = (recent.data ?? []).filter((message) => message.conversation_id === row.id);
    return {
      id: row.id,
      peerId,
      peerName: profile?.display_name ?? "Campus student",
      peerMajor: profile?.major ?? "",
      updatedAt: row.updated_at,
      lastMessage: messages[0]?.body,
      unread: messages.filter((message) => message.sender_id !== userId && !message.read_at).length,
    };
  });
}

export async function fetchDirectMessages(conversationId: string): Promise<DirectMessage[]> {
  const userId = await me();
  const result = await client().from("direct_messages")
    .select("id,conversation_id,sender_id,body,read_at,created_at")
    .eq("conversation_id", conversationId).order("created_at").limit(300);
  if (result.error) throw new Error(issue(result.error));
  const unreadIds = (result.data ?? []).filter((row) => row.sender_id !== userId && !row.read_at).map((row) => row.id);
  if (unreadIds.length) await client().from("direct_messages").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
  return (result.data ?? []).map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    mine: row.sender_id === userId,
    read: !!row.read_at,
    createdAt: row.created_at,
  }));
}

export async function sendDirectMessage(conversationId: string, id: string, body: string) {
  const text = body.trim();
  if (!text) return;
  if (text.length > 2000) throw new Error("Keep messages under 2,000 characters.");
  const userId = await me();
  const result = await client().from("direct_messages").insert({
    id, conversation_id: conversationId, sender_id: userId, body: text,
  });
  if (result.error) throw new Error(issue(result.error));
}

export async function fetchNotifications(): Promise<OrbitNotification[]> {
  const result = await client().from("notifications")
    .select("id,actor_id,kind,post_id,conversation_id,body,read_at,created_at")
    .order("created_at", { ascending: false }).limit(100);
  if (result.error) throw new Error(issue(result.error));
  const actorIds = [...new Set((result.data ?? []).map((row) => row.actor_id).filter(Boolean))] as string[];
  const profiles = actorIds.length
    ? await client().from("student_profiles").select("user_id,display_name").in("user_id", actorIds)
    : { data: [], error: null };
  if (profiles.error) throw new Error(issue(profiles.error));
  const names = new Map((profiles.data ?? []).map((row) => [row.user_id, row.display_name]));
  return (result.data ?? []).map((row) => ({
    id: row.id,
    actorName: names.get(row.actor_id) ?? "Someone",
    kind: row.kind,
    body: row.body,
    postId: row.post_id ?? undefined,
    conversationId: row.conversation_id ?? undefined,
    read: !!row.read_at,
    createdAt: row.created_at,
  }));
}

export async function markNotificationsRead() {
  const userId = await me();
  const result = await client().from("notifications").update({ read_at: new Date().toISOString() })
    .eq("recipient_id", userId).is("read_at", null);
  if (result.error) throw new Error(issue(result.error));
}

export function subscribeCampusSocial(refresh: () => void) {
  const supabase = auth;
  if (!supabase) return () => {};
  const channel = supabase.channel("orbit-social");
  for (const table of ["direct_conversations", "direct_messages", "notifications", "student_profiles", "student_follows", "user_blocks"])
    channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
  channel.subscribe();
  return () => { void supabase.removeChannel(channel); };
}
