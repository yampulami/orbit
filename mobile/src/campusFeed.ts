import { auth } from "./authClient";
import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import { campusKey, validCampus } from "../../src/campus";
import type { Comment, FeedPost, Media } from "../../src/feed";

type Row = {
  id: string;
  author_id: string;
  author_name: string;
  kind: FeedPost["kind"];
  community: FeedPost["community"];
  payload: Partial<FeedPost>;
  created_at: string;
  post_likes?: { user_id: string }[];
  post_comments?: { id: string; user_id: string; parent_id?: string | null; author_name: string; body: string; created_at: string }[];
  event_registrations?: { user_id: string }[];
  poll_votes?: { user_id: string; choice: number }[];
};

const TABLES = ["campus_posts", "post_likes", "post_comments", "event_registrations", "poll_votes"];

function client() {
  if (!auth) throw new Error("Orbit’s shared campus feed is not connected.");
  return auth;
}

function message(error: unknown) {
  const detail = error as { code?: string; message?: string } | null;
  if (detail?.code === "42P01" || /does not exist|schema cache/i.test(detail?.message ?? ""))
    return "The shared campus feed is being set up. Try again shortly.";
  if (/network|fetch|gateway|timeout/i.test(detail?.message ?? ""))
    return "Couldn’t reach the campus feed. Check your connection and pull down to retry.";
  return detail?.message || "Couldn’t update the campus feed.";
}

async function userId() {
  const { data, error } = await client().auth.getUser();
  if (error || !data.user) throw new Error("Sign in to use your university feed.");
  return data.user.id;
}

export async function joinCampus(campus: string) {
  if (!validCampus(campus)) throw new Error("Add your university in your profile to use the shared feed.");
  const id = await userId();
  const { error } = await client().from("campus_memberships").upsert({
    user_id: id,
    campus_key: campusKey(campus),
    campus_name: campus.trim(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(message(error));
  return id;
}

function rowToPost(row: Row, me: string): FeedPost {
  const comments: Comment[] = (row.post_comments ?? [])
    .map((x) => ({ id: x.id, userId: x.user_id, parentId: x.parent_id ?? undefined, author: x.author_name, mine: x.user_id === me, body: x.body, createdAt: x.created_at }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const votes = row.poll_votes ?? [];
  const options = row.payload.poll?.options ?? [];
  const eventUsers = row.event_registrations ?? [];
  return {
    ...(row.payload as FeedPost),
    id: row.id,
    authorId: row.author_id,
    author: row.author_name,
    kind: row.kind,
    community: row.community,
    createdAt: row.created_at,
    mine: row.author_id === me,
    sample: false,
    liked: (row.post_likes ?? []).some((x) => x.user_id === me),
    likes: (row.post_likes ?? []).length,
    comments,
    ...(row.payload.poll
      ? {
          poll: {
            ...row.payload.poll,
            votes: options.map((_, i) => votes.filter((x) => x.choice === i).length),
            choice: votes.find((x) => x.user_id === me)?.choice ?? null,
          },
        }
      : {}),
    ...(row.payload.event
      ? {
          event: {
            ...row.payload.event,
            going: eventUsers.length,
            registered: eventUsers.some((x) => x.user_id === me),
          },
        }
      : {}),
  };
}

async function hydrateMedia(post: FeedPost) {
  const stored = post.media?.uri;
  if (!stored?.startsWith("storage:")) return post;
  const path = stored.slice("storage:".length);
  const { data, error } = await client().storage.from("feed-media").createSignedUrl(path, 60 * 60);
  if (error) return { ...post, media: undefined };
  return { ...post, media: { ...post.media!, uri: data.signedUrl, storagePath: path } };
}

export async function fetchCampusFeed(campus: string) {
  const me = await joinCampus(campus);
  const { data, error } = await client()
    .from("campus_posts")
    .select("id,author_id,author_name,kind,community,payload,created_at,post_likes(user_id),post_comments(id,user_id,parent_id,author_name,body,created_at),event_registrations(user_id),poll_votes(user_id,choice)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(message(error));
  return Promise.all(((data ?? []) as unknown as Row[]).map((row) => hydrateMedia(rowToPost(row, me))));
}

function recoverLocalMedia(post: FeedPost): Media | undefined {
  if (post.media || Platform.OS === "web") return post.media;
  try {
    const match = new Directory(Paths.document)
      .list()
      .find((entry) => entry instanceof File && entry.name.startsWith(`orbit-post-${post.id}.`));
    if (!(match instanceof File)) return;
    const video = [".mp4", ".mov", ".m4v", ".webm"].includes(match.extension.toLowerCase());
    return { uri: match.uri, type: video ? "video" : "image" };
  } catch {
    return;
  }
}

function mediaType(media: Media, extension: string) {
  if (media.type === "video")
    return extension === ".mov" ? "video/quicktime" : extension === ".webm" ? "video/webm" : "video/mp4";
  return extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : extension === ".heic" ? "image/heic" : extension === ".heif" ? "image/heif" : "image/jpeg";
}

async function uploadMedia(campus: string, me: string, post: FeedPost) {
  const media = recoverLocalMedia(post);
  if (!media) return;
  if (media.storagePath) return { ...media, uri: `storage:${media.storagePath}` };
  if (media.uri.startsWith("storage:")) return media;
  if (media.uri.startsWith("http")) return media;
  let extension = media.uri.match(/\.(png|webp|heic|heif|jpe?g|mp4|mov|m4v|webm)(?:\?|$)/i)?.[0]?.toLowerCase();
  if (!extension || extension === ".jpeg" || extension === ".m4v")
    extension = media.type === "video" ? ".mp4" : ".jpg";
  const path = `${campusKey(campus)}/${me}/${post.id}${extension}`;
  const bytes = media.uri.startsWith("file:")
    ? await new File(media.uri).arrayBuffer()
    : await (await fetch(media.uri)).arrayBuffer();
  const { error } = await client().storage.from("feed-media").upload(path, bytes, {
    contentType: mediaType(media, extension),
    upsert: true,
  });
  if (error) throw new Error(`Couldn’t upload the attachment. ${message(error)}`);
  return { type: media.type, uri: `storage:${path}` } satisfies Media;
}

function remotePayload(post: FeedPost, media?: Media): Partial<FeedPost> {
  const { id: _id, author: _author, createdAt: _createdAt, mine: _mine, sample: _sample,
    liked: _liked, likes: _likes, comments: _comments, ...payload } = post;
  return {
    ...payload,
    media,
    poll: post.poll ? { ...post.poll, votes: [], choice: null } : undefined,
    event: post.event ? { ...post.event, going: 0, registered: false } : undefined,
    listing: post.listing ? { ...post.listing, messages: [] } : undefined,
  };
}

export async function publishCampusPost(campus: string, post: FeedPost) {
  const me = await joinCampus(campus);
  const media = await uploadMedia(campus, me, post);
  const { error } = await client().from("campus_posts").upsert({
    id: post.id,
    campus_key: campusKey(campus),
    author_id: me,
    author_name: post.author,
    kind: post.kind,
    community: post.community,
    payload: remotePayload(post, media),
    created_at: post.createdAt,
  }, { onConflict: "id" });
  if (error) throw new Error(message(error));
}

export async function removeCampusPost(id: string, storagePath?: string) {
  const { error } = await client().from("campus_posts").delete().eq("id", id);
  if (error) throw new Error(message(error));
  if (storagePath) await client().storage.from("feed-media").remove([storagePath]);
}

export async function setCampusLike(postId: string, liked: boolean) {
  const me = await userId();
  const query = liked
    ? client().from("post_likes").upsert({ post_id: postId, user_id: me })
    : client().from("post_likes").delete().eq("post_id", postId).eq("user_id", me);
  const { error } = await query;
  if (error) throw new Error(message(error));
}

export async function addCampusComment(postId: string, comment: Comment) {
  const me = await userId();
  const { error } = await client().from("post_comments").insert({
    id: comment.id, post_id: postId, user_id: me, author_name: comment.author,
    parent_id: comment.parentId ?? null, body: comment.body, created_at: comment.createdAt,
  });
  if (error) throw new Error(message(error));
}

export async function setEventRegistration(postId: string, registered: boolean) {
  const me = await userId();
  const query = registered
    ? client().from("event_registrations").upsert({ post_id: postId, user_id: me })
    : client().from("event_registrations").delete().eq("post_id", postId).eq("user_id", me);
  const { error } = await query;
  if (error) throw new Error(message(error));
}

export async function setPollVote(postId: string, choice: number | null) {
  const me = await userId();
  const query = choice === null
    ? client().from("poll_votes").delete().eq("post_id", postId).eq("user_id", me)
    : client().from("poll_votes").upsert({ post_id: postId, user_id: me, choice });
  const { error } = await query;
  if (error) throw new Error(message(error));
}

export function subscribeCampusFeed(campus: string, refresh: () => void) {
  const supabase = auth;
  if (!supabase || !validCampus(campus)) return () => {};
  const channel = supabase.channel(`campus-feed-${campusKey(campus)}`);
  for (const table of TABLES)
    channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
  channel.subscribe();
  return () => { void supabase.removeChannel(channel); };
}
