import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { loadNames, watchTables } from "./people";
import { currentUserId } from "./campusOrgs";
import { notice } from "./notice";

/** A club's own feed: announcements (public to the campus, notify the club), discussion posts and polls (for the club's people), with replies.
 *  Who may do what is decided by the database from the club's roles; the screen only hides the buttons that would be refused. */
export type PostKind = "announcement" | "post" | "poll";
export type RawPost = { id: string; org_id: string; author_id: string; kind: PostKind; title: string; body: string; pinned: boolean; created_at: string };
export type RawComment = { id: string; post_id: string; author_id: string; body: string; created_at: string };
export type RawOption = { id: string; post_id: string; label: string; position: number };
export type RawResult = { post_id: string; option_id: string; votes: number; mine: boolean };
export type RawVote = { post_id: string; user_id: string; option_id: string };

export type Post = {
  id: string; authorId: string; author: string; kind: PostKind; title: string; body: string; pinned: boolean; at: string; mine: boolean;
  comments: { id: string; author: string; body: string; at: string; mine: boolean }[];
  /** For a poll: each choice with its votes, how many voted, and the choice I picked. */
  options?: { id: string; label: string; votes: number; mine: boolean }[]; total?: number; myVote?: string;
};

/** Pure: rows in, what the feed shows. Pinned first, then newest first. */
export function buildFeed(posts: RawPost[], comments: RawComment[], options: RawOption[], results: RawResult[], names: Record<string, string>, me: string): Post[] {
  const who = (id: string) => (id === me ? "You" : names[id] ?? "Member");
  return [...posts]
    .map((p): Post => {
      const base: Post = {
        id: p.id, authorId: p.author_id, author: who(p.author_id), kind: p.kind, title: p.title, body: p.body, pinned: p.pinned, at: p.created_at, mine: p.author_id === me,
        comments: comments.filter((c) => c.post_id === p.id).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((c) => ({ id: c.id, author: who(c.author_id), body: c.body, at: c.created_at, mine: c.author_id === me })),
      };
      if (p.kind !== "poll") return base;
      const opts = options.filter((o) => o.post_id === p.id).sort((a, b) => a.position - b.position).map((o) => {
        const r = results.find((x) => x.option_id === o.id);
        return { id: o.id, label: o.label, votes: r?.votes ?? 0, mine: !!r?.mine };
      });
      return { ...base, options: opts, total: opts.reduce((n, o) => n + o.votes, 0), myVote: opts.find((o) => o.mine)?.id };
    })
    .sort((a, b) => (a.pinned === b.pinned ? b.at.localeCompare(a.at) : a.pinned ? -1 : 1));
}

/** What is wrong with a new post, in plain words, or null. */
export function problemWithPost(d: { kind: PostKind; title: string; body: string }): string | null {
  if (d.kind === "announcement" && !d.title.trim()) return "Give the announcement a headline.";
  if (d.kind !== "announcement" && !d.body.trim()) return "Write something first.";
  if (d.title.length > 120) return "Keep the headline under 120 characters.";
  if (d.body.length > 2000) return "That is a little long. Keep it under 2000 characters.";
  return null;
}
/** What is wrong with a new poll, or null. */
export function problemWithPoll(question: string, options: string[]): string | null {
  const opts = options.map((o) => o.trim()).filter(Boolean);
  if (!question.trim()) return "Ask a question.";
  if (question.trim().length > 120) return "Keep the question under 120 characters.";
  if (opts.length < 2) return "Give at least two choices.";
  if (opts.length > 6) return "Six choices at most.";
  if (opts.some((o) => o.length > 80)) return "Keep each choice under 80 characters.";
  if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) return "Two of the choices are the same.";
  return null;
}
/** The newest post's time (or nothing), for the club's activity indicator. */
export const lastPostAt = (posts: { at: string }[]) => posts.reduce<string | undefined>((m, p) => (!m || p.at > m ? p.at : m), undefined);

/* ---------- store ---------- */
const live = !!supabase;
const DEMO_KEY = "orbit-demo-club-feed";
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
type Demo = { posts: RawPost[]; comments: RawComment[]; options: RawOption[]; votes: RawVote[] };
const demoStart = (): Demo => ({
  posts: [
    { id: "p1", org_id: "o1", author_id: "demo-sam", kind: "announcement", title: "Build night moved to Thursday", body: "The lab is booked on Wednesday, so we are meeting Thursday at 7:30 PM instead. Same room, same snacks.", pinned: true, created_at: ago(3 * 3600_000) },
    { id: "p2", org_id: "o1", author_id: "demo-me", kind: "poll", title: "Which kit should we order for spring?", body: "", pinned: false, created_at: ago(26 * 3600_000) },
    { id: "p3", org_id: "o1", author_id: "demo-riley", kind: "post", title: "", body: "Anyone want to carpool to the regional competition? I have two seats.", pinned: false, created_at: ago(50 * 3600_000) },
  ],
  comments: [{ id: "c1", post_id: "p3", author_id: "demo-maya", body: "Yes please! I can chip in for gas.", created_at: ago(48 * 3600_000) }],
  options: [{ id: "op1", post_id: "p2", label: "Starter wheeled kit", position: 1 }, { id: "op2", post_id: "p2", label: "Robotic arm kit", position: 2 }, { id: "op3", post_id: "p2", label: "Drone kit", position: 3 }],
  votes: [{ post_id: "p2", user_id: "demo-sam", option_id: "op2" }, { post_id: "p2", user_id: "demo-riley", option_id: "op2" }, { post_id: "p2", user_id: "demo-maya", option_id: "op1" }],
});
const DEMO_NAMES: Record<string, string> = { "demo-sam": "Sam", "demo-riley": "Riley", "demo-maya": "Maya" };
const readDemo = (): Demo => { try { const s = localStorage.getItem(DEMO_KEY); if (s) return JSON.parse(s) as Demo; } catch { /* none saved */ } return demoStart(); };
const writeDemo = (d: Demo) => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(d)); } catch { /* ignore */ } };
const fail = (message: string) => { notice.show({ icon: "alert", title: "That did not work", message }); return message; };

/** One club's feed, with the actions to post, vote and reply. Refreshes live, and every few seconds for poll totals. */
export function useClubFeed(orgId: string, enabled = true) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [ready, setReady] = useState(false);
  const mount = useRef(0);

  const load = useCallback(async () => {
    const me = currentUserId() ?? "";
    const id = mount.current;
    if (!live) {
      const d = readDemo();
      const mine = d.posts.filter((p) => p.org_id === orgId);
      const ids = new Set(mine.map((p) => p.id));
      const results: RawResult[] = d.options.filter((o) => ids.has(o.post_id)).map((o) => ({ post_id: o.post_id, option_id: o.id, votes: d.votes.filter((v) => v.option_id === o.id).length, mine: d.votes.some((v) => v.option_id === o.id && v.user_id === me) }));
      setPosts(buildFeed(mine, d.comments.filter((c) => ids.has(c.post_id)), d.options.filter((o) => ids.has(o.post_id)), results, DEMO_NAMES, me));
      setReady(true);
      return;
    }
    try {
      const p = await supabase!.from("campus_club_posts").select("id,org_id,author_id,kind,title,body,pinned,created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(120);
      // Before the feed migration is applied the table is missing: show an empty feed, never an error.
      if (p.error) { if (id === mount.current) { setPosts([]); setReady(true); } return; }
      const rows = (p.data ?? []) as RawPost[];
      const ids = rows.map((r) => r.id);
      const [c, o, r] = await Promise.all([
        ids.length ? supabase!.from("campus_club_post_comments").select("id,post_id,author_id,body,created_at").in("post_id", ids).limit(2000) : Promise.resolve({ data: [], error: null }),
        ids.length ? supabase!.from("campus_club_poll_options").select("id,post_id,label,position").in("post_id", ids).limit(1000) : Promise.resolve({ data: [], error: null }),
        rows.some((x) => x.kind === "poll") ? supabase!.rpc("club_poll_results", { org: orgId }) : Promise.resolve({ data: [], error: null }),
      ]);
      const comments = (c.data ?? []) as RawComment[];
      const names = await loadNames([...rows.map((x) => x.author_id), ...comments.map((x) => x.author_id)]).catch(() => ({}));
      if (id !== mount.current) return;
      setPosts(buildFeed(rows, comments, (o.data ?? []) as RawOption[], ((r.data ?? []) as RawResult[]).map((x) => ({ ...x, votes: Number(x.votes) })), names, me));
      setReady(true);
    } catch { /* keep what is on screen */ }
  }, [orgId]);

  useEffect(() => {
    if (!enabled) return;
    mount.current++;
    setReady(false);
    void load();
    const stop = live ? watchTables(`orbit-club-${orgId}`, ["campus_club_posts", "campus_club_post_comments"], () => void load()) : () => undefined;
    // Poll votes are private rows, so totals do not arrive live: look again every few seconds while the feed is open.
    const t = live ? window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 10_000) : 0;
    return () => { mount.current++; stop(); if (t) window.clearInterval(t); };
  }, [orgId, enabled, load]);

  const run = async (demo: (d: Demo, me: string) => void, remote: (me: string) => Promise<{ error: { message: string } | null }>): Promise<string | null> => {
    const me = currentUserId();
    if (!me) return "Sign in first.";
    if (!live) { const d = readDemo(); demo(d, me); writeDemo(d); await load(); return null; }
    const { error } = await remote(me);
    if (error) return fail(error.message);
    await load();
    return null;
  };
  const uid = () => crypto.randomUUID();

  const actions = {
    announce: (title: string, body: string) => {
      const bad = problemWithPost({ kind: "announcement", title, body }); if (bad) return Promise.resolve(bad);
      const row = { org_id: orgId, kind: "announcement" as const, title: title.trim(), body: body.trim() };
      return run((d, me) => { d.posts.push({ id: uid(), author_id: me, pinned: false, created_at: new Date().toISOString(), ...row }); }, (me) => Promise.resolve(supabase!.from("campus_club_posts").insert({ ...row, author_id: me })));
    },
    discuss: (body: string) => {
      const bad = problemWithPost({ kind: "post", title: "", body }); if (bad) return Promise.resolve(bad);
      const row = { org_id: orgId, kind: "post" as const, title: "", body: body.trim() };
      return run((d, me) => { d.posts.push({ id: uid(), author_id: me, pinned: false, created_at: new Date().toISOString(), ...row }); }, (me) => Promise.resolve(supabase!.from("campus_club_posts").insert({ ...row, author_id: me })));
    },
    poll: (question: string, options: string[]) => {
      const bad = problemWithPoll(question, options); if (bad) return Promise.resolve(bad);
      const opts = options.map((o) => o.trim()).filter(Boolean);
      return run((d, me) => {
        const id = uid();
        d.posts.push({ id, org_id: orgId, author_id: me, kind: "poll", title: question.trim(), body: "", pinned: false, created_at: new Date().toISOString() });
        opts.forEach((label, i) => d.options.push({ id: uid(), post_id: id, label, position: i + 1 }));
      }, () => Promise.resolve(supabase!.rpc("create_club_poll", { org: orgId, question: question.trim(), options: opts })));
    },
    vote: (postId: string, optionId: string) =>
      run((d, me) => { d.votes = d.votes.filter((v) => !(v.post_id === postId && v.user_id === me)); d.votes.push({ post_id: postId, user_id: me, option_id: optionId }); }, () => Promise.resolve(supabase!.rpc("vote_club_poll", { post: postId, option: optionId }))),
    comment: (postId: string, body: string) => {
      const t = body.trim(); if (!t) return Promise.resolve("Write something first.");
      return run((d, me) => { d.comments.push({ id: uid(), post_id: postId, author_id: me, body: t.slice(0, 500), created_at: new Date().toISOString() }); }, (me) => Promise.resolve(supabase!.from("campus_club_post_comments").insert({ post_id: postId, author_id: me, body: t.slice(0, 500) })));
    },
    pin: (postId: string, pinned: boolean) =>
      run((d) => { d.posts = d.posts.map((p) => (p.id === postId ? { ...p, pinned } : p)); }, () => Promise.resolve(supabase!.from("campus_club_posts").update({ pinned }).eq("id", postId))),
    remove: (postId: string) =>
      run((d) => { d.posts = d.posts.filter((p) => p.id !== postId); d.comments = d.comments.filter((c) => c.post_id !== postId); }, () => Promise.resolve(supabase!.from("campus_club_posts").delete().eq("id", postId))),
    removeComment: (commentId: string) =>
      run((d) => { d.comments = d.comments.filter((c) => c.id !== commentId); }, () => Promise.resolve(supabase!.from("campus_club_post_comments").delete().eq("id", commentId))),
  };
  return { posts, ready, actions };
}
