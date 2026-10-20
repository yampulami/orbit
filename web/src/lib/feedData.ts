import { supabase } from "./supabase";

export type Comment = { id: string; user_id: string; author_name: string; body: string; created_at: string };
export type Row = {
  id: string; author_id: string; author_name: string; kind: string; community: string;
  payload: { body?: string; text?: string; title?: string };
  created_at: string;
  post_likes: { user_id: string }[]; post_comments: Comment[];
};
export type Campus = { name: string; key: string };
export type NewPost = { id: string; campus_key: string; author_id: string; author_name: string; community: string; body: string };

export interface FeedApi {
  campus(): Promise<Campus | null>;
  join(c: Campus, me: string): Promise<void>;
  list(): Promise<Row[]>;
  publish(p: NewPost): Promise<void>;
  like(postId: string, me: string, liked: boolean): Promise<void>;
  remove(id: string): Promise<void>;
  comment(postId: string, me: string, author: string, body: string): Promise<void>;
}

function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }

const supaApi: FeedApi = {
  async campus() {
    const { data } = await supabase!.from("campus_memberships").select("campus_name,campus_key").maybeSingle();
    return data ? { name: data.campus_name, key: data.campus_key } : null;
  },
  async join(c, me) {
    fail((await supabase!.from("campus_memberships").upsert({ user_id: me, campus_key: c.key, campus_name: c.name, updated_at: new Date().toISOString() })).error);
  },
  async list() {
    const { data, error } = await supabase!.from("campus_posts")
      .select("id,author_id,author_name,kind,community,payload,created_at,post_likes(user_id),post_comments(id,user_id,author_name,body,created_at)")
      .order("created_at", { ascending: false }).limit(50);
    fail(error);
    return ((data ?? []) as unknown as Row[]).map((r) => ({ ...r, post_comments: [...r.post_comments].sort((a, b) => a.created_at.localeCompare(b.created_at)) }));
  },
  async publish(p) {
    fail((await supabase!.from("campus_posts").insert({ id: p.id, campus_key: p.campus_key, author_id: p.author_id, author_name: p.author_name, kind: "post", community: p.community, payload: { body: p.body } })).error);
  },
  async like(postId, me, liked) {
    fail((liked ? await supabase!.from("post_likes").upsert({ post_id: postId, user_id: me }) : await supabase!.from("post_likes").delete().eq("post_id", postId).eq("user_id", me)).error);
  },
  async remove(id) { fail((await supabase!.from("campus_posts").delete().eq("id", id)).error); },
  async comment(postId, me, author, body) {
    fail((await supabase!.from("post_comments").insert({ id: crypto.randomUUID(), post_id: postId, user_id: me, author_name: author, body })).error);
  },
};

/* ---------- Demo mode: runs fully in the browser, no account needed ---------- */
const KEY = "orbit-demo-feed-v1";
const ago = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const seed = (): Row[] => [
  { id: "d1", author_id: "u-maya", author_name: "Maya", kind: "post", community: "Everyone", created_at: ago(18), payload: { body: "Library 3rd floor quiet room is empty right now. Midterm week is rough, good luck everyone." }, post_likes: [{ user_id: "u-sam" }, { user_id: "u-lee" }], post_comments: [{ id: "c1", user_id: "u-sam", author_name: "Sam", body: "Heading there now, thank you!", created_at: ago(10) }] },
  { id: "d2", author_id: "u-jordan", author_name: "Jordan", kind: "post", community: "Commuters", created_at: ago(95), payload: { body: "Anyone driving in from Montclair tomorrow around 8:30? Happy to split gas." }, post_likes: [{ user_id: "u-maya" }], post_comments: [] },
  { id: "d3", author_id: "u-priya", author_name: "Priya", kind: "post", community: "Marketplace", created_at: ago(300), payload: { body: "Selling a lightly used Calc II textbook, $25. Pickup at the student center." }, post_likes: [], post_comments: [] },
  { id: "d4", author_id: "u-lee", author_name: "Lee", kind: "post", community: "Roommates", created_at: ago(1500), payload: { body: "Reminder: quiet hours start at 10pm in Hamilton Hall this week. Thanks all!" }, post_likes: [{ user_id: "u-maya" }, { user_id: "u-jordan" }, { user_id: "u-priya" }], post_comments: [] },
];
let mem: Row[] | null = null;
function read(): Row[] {
  if (mem) return mem;
  try { const s = localStorage.getItem(KEY); if (s) return (mem = JSON.parse(s)); } catch { /* storage unavailable */ }
  return (mem = seed());
}
function write(rows: Row[]) { mem = rows; try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* ignore */ } }

const demoApi: FeedApi = {
  async campus() { return { name: "Caldwell University", key: "caldwell-university" }; },
  async join() {},
  async list() { return structuredClone(read()); },
  async publish(p) {
    write([{ id: p.id, author_id: p.author_id, author_name: p.author_name, kind: "post", community: p.community, created_at: new Date().toISOString(), payload: { body: p.body }, post_likes: [], post_comments: [] }, ...read()]);
  },
  async like(postId, me, liked) {
    write(read().map((r) => r.id !== postId ? r : { ...r, post_likes: liked ? [...r.post_likes.filter((l) => l.user_id !== me), { user_id: me }] : r.post_likes.filter((l) => l.user_id !== me) }));
  },
  async remove(id) { write(read().filter((r) => r.id !== id)); },
  async comment(postId, me, author, body) {
    write(read().map((r) => r.id !== postId ? r : { ...r, post_comments: [...r.post_comments, { id: crypto.randomUUID(), user_id: me, author_name: author, body, created_at: new Date().toISOString() }] }));
  },
};

export const feedApi: FeedApi = supabase ? supaApi : demoApi;
export const isDemo = !supabase;
