import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, MessageCircle, Trash2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { feedApi as api, isDemo, type Row } from "../lib/feedData";
import { campusKey, validCampus } from "../shared/campus";
import { communities, type Community } from "../shared/feed";

const MAX = 1000;
const when = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m}m ago`; if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return new Date(iso).toLocaleDateString();
};

export default function Feed() {
  const { session } = useAuth();
  const me = session?.user.id ?? "";
  const name = (session?.user.user_metadata?.name as string | undefined) || session?.user.email?.split("@")[0] || "Student";

  const [campusInput, setCampusInput] = useState("");
  const [campus, setCampus] = useState<{ name: string; key: string } | null>(null);
  const [posts, setPosts] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [community, setCommunity] = useState<Community>("Everyone");
  const [posting, setPosting] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const run = async (fn: () => Promise<void>) => { setError(""); try { await fn(); } catch (e) { setError((e as Error).message); } };
  const load = () => run(async () => { const c = await api.campus(); setCampus(c); if (c) setPosts(await api.list()); setLoading(false); });
  useEffect(() => { load(); }, []);

  const join = () => run(async () => {
    if (!validCampus(campusInput)) throw new Error("Enter your university name.");
    await api.join({ name: campusInput.trim(), key: campusKey(campusInput) }, me); await load();
  });

  async function publish(e: FormEvent) {
    e.preventDefault();
    const text = body.trim(); if (!campus || !text) return;
    setPosting(true);
    await run(async () => { await api.publish({ id: crypto.randomUUID(), campus_key: campus.key, author_id: me, author_name: name, community, body: text }); setBody(""); await load(); });
    setPosting(false);
  }

  async function like(p: Row) {
    const liked = p.post_likes.some((l) => l.user_id === me);
    setPosts((ps) => ps.map((x) => x.id !== p.id ? x : { ...x, post_likes: liked ? x.post_likes.filter((l) => l.user_id !== me) : [...x.post_likes, { user_id: me }] }));
    await run(() => api.like(p.id, me, !liked));
  }

  const remove = (p: Row) => run(async () => { await api.remove(p.id); setPosts((ps) => ps.filter((x) => x.id !== p.id)); });
  const sendComment = (p: Row) => { const t = draft.trim(); if (!t) return; setDraft(""); return run(async () => { await api.comment(p.id, me, name, t); await load(); }); };

  if (loading) return <p className="muted">Loading your feed…</p>;

  if (!campus)
    return (
      <>
        <h1>Join your campus</h1>
        <div className="card" style={{ display: "grid", gap: 12 }}>
          <p className="muted">Your feed is limited to your university. Enter it to continue.</p>
          <label className="field">University<input value={campusInput} onChange={(e) => setCampusInput(e.target.value)} placeholder="e.g. Caldwell University" /></label>
          {error && <p className="error">{error}</p>}
          <button className="btn primary" onClick={join}>Join campus</button>
        </div>
      </>
    );

  return (
    <>
      <h1>{campus.name}</h1>
      {isDemo && <p className="notice" style={{ marginBottom: 14 }}>Demo mode: posts are saved in this browser only.</p>}
      <form className="card post" onSubmit={publish}>
        <label className="field">
          <span className="sr">Write a post</span>
          <textarea id="composer" rows={3} maxLength={MAX} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What’s happening on campus?" />
        </label>
        <div className="composer-row">
          <label className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Post to
            <select id="community" value={community} onChange={(e) => setCommunity(e.target.value as Community)} className="select">
              {communities.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <span className="muted" style={{ fontSize: ".8rem" }}>{body.length}/{MAX}</span>
          <button className="btn primary" disabled={posting || !body.trim()}>{posting ? "Posting…" : "Post"}</button>
        </div>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {posts.length === 0 && <div className="card"><p className="muted">No posts yet. Be the first.</p></div>}
      <AnimatePresence initial={false}>
        {posts.map((p) => {
          const liked = p.post_likes.some((l) => l.user_id === me);
          const expanded = open === p.id;
          return (
            <motion.article key={p.id} layout className="card post" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <div className="meta"><span><strong style={{ color: "var(--text)" }}>{p.author_name}</strong> · {when(p.created_at)}</span><span className="chip">{p.community}</span></div>
              {p.payload.title && <h3>{p.payload.title}</h3>}
              <p style={{ whiteSpace: "pre-wrap" }}>{p.payload.body ?? p.payload.text ?? ""}</p>
              <div className="actions">
                <motion.button whileTap={{ scale: 0.85 }} className="iconbtn" aria-pressed={liked} aria-label={liked ? "Unlike" : "Like"} onClick={() => like(p)} style={liked ? { color: "#f2a49a" } : undefined}>
                  <Heart size={18} fill={liked ? "currentColor" : "none"} />{p.post_likes.length}
                </motion.button>
                <button className="iconbtn" aria-expanded={expanded} aria-label="Comments" onClick={() => { setOpen(expanded ? null : p.id); setDraft(""); }}>
                  <MessageCircle size={18} />{p.post_comments.length}
                </button>
                {p.author_id === me && <button className="iconbtn" style={{ marginLeft: "auto" }} aria-label="Delete post" onClick={() => remove(p)}><Trash2 size={17} /></button>}
              </div>
              {expanded && (
                <div className="comments">
                  {p.post_comments.map((c) => (
                    <p key={c.id}><strong>{c.author_name}</strong> <span className="muted">{when(c.created_at)}</span><br />{c.body}</p>
                  ))}
                  <form className="comment-form" onSubmit={(e) => { e.preventDefault(); sendComment(p); }}>
                    <input aria-label="Write a comment" maxLength={500} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a comment…" />
                    <button className="btn primary" disabled={!draft.trim()}>Reply</button>
                  </form>
                </div>
              )}
            </motion.article>
          );
        })}
      </AnimatePresence>
    </>
  );
}
