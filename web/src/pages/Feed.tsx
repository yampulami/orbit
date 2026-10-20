import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronDown, Flame, Heart, MessageCircle, Trash2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { feedApi as api, type Row } from "../lib/feedData";
import { campusKey, validCampus } from "../shared/campus";
import { communities, type Community } from "../shared/feed";
import { enter, exit } from "../lib/motion";
import Calendar from "../components/Calendar";
import CommunityPicker from "../components/CommunityPicker";
import { communityIcon } from "../lib/communityUi";
import HangoutCard from "../components/HangoutCard";
import { useHang } from "../lib/hangouts";
import { progress, streakWeeks, useProgress } from "../lib/progress";
import { undo } from "../lib/undo";

const MAX = 1000;
const hue: Record<string, string> = { Everyone: "var(--pink)", Commuters: "var(--peach)", Residents: "var(--mint)", Roommates: "var(--lav)", Marketplace: "var(--butter)" };
const initials = (n: string) => n.trim().slice(0, 1).toUpperCase() || "?";
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
  const [filter, setFilter] = useState<"All" | Community>("All");
  const [calOpen, setCalOpen] = useState(() => { try { return localStorage.getItem("orbit-feed-cal") === "1"; } catch { return false; } });
  const toggleCal = () => setCalOpen((v) => { try { localStorage.setItem("orbit-feed-cal", v ? "0" : "1"); } catch { /* ignore */ } return !v; });
  const [day, setDay] = useState<string | null>(null);

  const { groups, hangouts } = useHang();
  const prog = useProgress();
  const weeks = prog.enabled ? streakWeeks(prog) : 0;
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
    await run(async () => { await api.publish({ id: crypto.randomUUID(), campus_key: campus.key, author_id: me, author_name: name, community, body: text }); progress.log("post"); setBody(""); await load(); });
    setPosting(false);
  }

  async function like(p: Row) {
    const liked = p.post_likes.some((l) => l.user_id === me);
    setPosts((ps) => ps.map((x) => x.id !== p.id ? x : { ...x, post_likes: liked ? x.post_likes.filter((l) => l.user_id !== me) : [...x.post_likes, { user_id: me }] }));
    await run(() => api.like(p.id, me, !liked));
  }

  // Deleting is undoable: the post leaves the feed now, and the real delete runs after the undo window.
  const remove = (p: Row) => {
    setPosts((ps) => ps.filter((x) => x.id !== p.id));
    undo.show("Post deleted", {
      onUndo: () => setPosts((ps) => (ps.some((x) => x.id === p.id) ? ps : [...ps, p].sort((a, b) => b.created_at.localeCompare(a.created_at)))),
      commit: () => api.remove(p.id),
    });
  };
  const sendComment = (p: Row) => { const t = draft.trim(); if (!t) return; setDraft(""); return run(async () => { await api.comment(p.id, me, name, t); progress.log("reply"); await load(); }); };

  if (loading)
    return (
      <div className="feed-layout" aria-busy="true" aria-label="Loading your feed">
        <div className="feed-main">
          <div className="skeleton sk-card" />
          <div className="skeleton sk-composer" />
          <div className="posts"><div className="skeleton sk-tile" /><div className="skeleton sk-tile" /></div>
        </div>
      </div>
    );
  if (!campus)
    return (
      <div className="page">
        <h1 style={{ maxWidth: "12ch" }}>Join your campus</h1>
        <div className="card" style={{ display: "grid", gap: 12, maxWidth: 520 }}>
          <p className="muted">Your feed is limited to your university. Enter it to continue.</p>
          <label className="field">University<input value={campusInput} onChange={(e) => setCampusInput(e.target.value)} placeholder="e.g. Caldwell University" /></label>
          {error && <p className="error">{error}</p>}
          <button className="btn primary" onClick={join}>Join campus</button>
        </div>
      </div>
    );

  const shown = posts.filter((p) => (filter === "All" || p.community === filter) && (!day || new Date(p.created_at).toDateString() === day));
  const upcoming = hangouts
    .filter((h) => !h.canceled && groups.some((g) => g.id === h.groupId) && new Date(h.when).getTime() > Date.now() - 3 * 3600000)
    .sort((x, y) => x.when.localeCompare(y.when));
  const recent = [...new Map(posts.map((p) => [p.author_name, p] as const)).values()].slice(0, 5);

  return (
    <div className="feed-layout">
      <div className="feed-main">
        <h1 className="sr">Campus feed</h1>
        <section className="hangs" aria-label="Hangouts">
          <header>
            <h2>Hangouts</h2>
            <div className="hangs-actions">
              {weeks > 0 && <span className="streak-chip" aria-label={`${weeks} week streak`}><Flame size={16} strokeWidth={1.75} aria-hidden="true" />{weeks} week{weeks === 1 ? "" : "s"}</span>}
              <Link to="/app/groups" className="pill-link">Plan one</Link>
            </div>
          </header>
          {upcoming.length === 0 ? (
            <div className="hang-empty">
              <p className="muted">No hangouts planned. Start a group with friends, then plan one from the chat.</p>
              <Link to="/app/groups" className="btn primary">Go to groups</Link>
            </div>
          ) : (
            <div className="hang-row">
              {upcoming.map((h, i) => <HangoutCard key={h.id} h={h} group={groups.find((g) => g.id === h.groupId)?.name ?? ""} tone={i} />)}
            </div>
          )}
        </section>
        <form className="card post composer" onSubmit={publish}>
          <label className="field">
            <span className="sr">Write a post</span>
            <textarea id="composer" rows={3} maxLength={MAX} value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} placeholder="What’s happening on campus?" />
          </label>
          <div className="composer-row">
            <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span id="post-to">Post to</span>
              <CommunityPicker value={community} onChange={setCommunity} labelledBy="post-to" />
            </div>
            <span className={"count" + (body.length > MAX * 0.9 ? " warn" : "")} aria-live="polite">{body.length}/{MAX}</span>
            <button className="btn primary" disabled={posting || !body.trim()}>{posting ? "Posting…" : "Post"}</button>
          </div>
        </form>
        <div className="pills" role="group" aria-label="Filter by community">
          {(["All", ...communities] as const).map((c) => {
            const { Icon, ink } = communityIcon[c];
            return (
              <button key={c} type="button" className="pill" aria-pressed={filter === c} onClick={() => { setFilter(c); if (c === "All") setDay(null); }}>
                <span className="dot" style={{ color: ink }}><Icon size={16} strokeWidth={1.9} aria-hidden="true" /></span>{c}
              </button>
            );
          })}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="label">{filter === "All" ? "Latest" : filter}{day ? ` on ${new Date(day).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""} at {campus.name}</p>
        <div className="posts">
          {shown.length === 0 && <p className="empty">{posts.length === 0 ? "No posts yet. Be the first." : `Nothing in ${filter} yet.`}</p>}
          <AnimatePresence initial={false}>
            {shown.map((p) => {
              const liked = p.post_likes.some((l) => l.user_id === me);
              const expanded = open === p.id;
              const people = [...new Set(p.post_comments.map((c) => c.author_name))].slice(0, 3);
              return (
                <motion.article key={p.id} layout="position" className="card post tile" data-c={p.community} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: enter }} exit={{ opacity: 0, transition: exit }} transition={enter}>
                  <div className="meta"><span><strong style={{ color: "var(--ink)" }}>{p.author_name}</strong> · {when(p.created_at)}</span><span className="chip">{p.community}</span></div>
                  {p.payload.title && <h3>{p.payload.title}</h3>}
                  <p className="body" style={{ whiteSpace: "pre-wrap" }}>{p.payload.body ?? p.payload.text ?? ""}</p>
                  <div className="foot">
                    {people.length > 0 && <span className="avatars" aria-hidden="true">{people.map((n) => <span key={n}>{initials(n)}</span>)}</span>}
                    <div className="actions" style={{ width: "auto", marginLeft: "auto" }}>
                      <motion.button whileTap={{ scale: 0.88 }} className="iconbtn" aria-pressed={liked} aria-label={liked ? "Unlike" : "Like"} onClick={() => like(p)}>
                        <motion.span key={liked ? "on" : "off"} style={{ display: "inline-flex" }} initial={liked ? { scale: 0.7 } : false} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 22 }}><Heart size={16} fill={liked ? "currentColor" : "none"} /></motion.span>{p.post_likes.length}
                      </motion.button>
                      <button className="iconbtn" aria-expanded={expanded} aria-label="Comments" onClick={() => { setOpen(expanded ? null : p.id); setDraft(""); }}>
                        <MessageCircle size={16} />{p.post_comments.length}
                      </button>
                      {p.author_id === me && <button className="iconbtn" aria-label="Delete post" onClick={() => remove(p)}><Trash2 size={16} /></button>}
                    </div>
                  </div>
                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div className="reveal" key="comments" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1, transition: enter }} exit={{ height: 0, opacity: 0, transition: exit }}>
                        <div className="comments">
                          {p.post_comments.map((c) => (
                            <p key={c.id}><strong>{c.author_name}</strong> <span style={{ opacity: 0.7 }}>{when(c.created_at)}</span><br />{c.body}</p>
                          ))}
                          <form className="comment-form" onSubmit={(e) => { e.preventDefault(); sendComment(p); }}>
                            <input aria-label="Write a comment" maxLength={500} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a comment…" />
                            <button className="btn primary" disabled={!draft.trim()}>Reply</button>
                          </form>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
      <aside className="rail" aria-label="Your campus summary">
        <section className="cal-fold">
          <button type="button" className="cal-toggle" aria-expanded={calOpen} onClick={toggleCal}>
            <span className="cal-ico"><CalendarDays size={18} strokeWidth={1.75} /></span>
            <span>Calendar{day ? " · 1 day selected" : ""}</span>
            <ChevronDown size={18} className="cal-chev" />
          </button>
          <AnimatePresence initial={false}>
            {calOpen && (
              <motion.div key="cal" className="reveal" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1, transition: enter }} exit={{ height: 0, opacity: 0, transition: exit }}>
                <Calendar posts={posts} day={day} onDay={setDay} />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
        <section className="people" aria-label="Active on campus">
          <header><h3>Active on campus</h3><span className="muted">{recent.length}</span></header>
          {recent.length === 0 && <p className="muted" style={{ fontSize: ".85rem" }}>No one has posted yet.</p>}
          <ul>
            {recent.map((p) => (
              <li key={p.author_name}>
                <span className="pa" style={{ background: hue[p.community] }} aria-hidden="true">{initials(p.author_name)}</span>
                <div><strong>{p.author_name}</strong><span>Posted in {p.community}</span></div>
                <time>{when(p.created_at)}</time>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
