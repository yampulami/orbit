import { useEffect, useRef, useState, type FormEvent } from "react";
import EmojiButton from "../components/EmojiButton";
import { useDisplayName } from "../lib/displayName";
import { AnimatePresence, motion } from "framer-motion";
import { Link, Navigate } from "react-router-dom";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Flame, Pin, Heart, MessageCircle, Trash2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { feedApi as api, type Row } from "../lib/feedData";
import { campusKey, validCampus } from "../shared/campus";
import { communities, type Community } from "../shared/feed";
import { enter, exit } from "../lib/motion";
import Calendar from "../components/Calendar";
import UpcomingList from "../components/UpcomingList";
import CommunityPicker from "../components/CommunityPicker";
import { communityIcon } from "../lib/communityUi";
import { usePins } from "../lib/pins";
import { notice } from "../lib/notice";
import HangoutCard from "../components/HangoutCard";
import CommentThread from "../components/CommentThread";
import PersonLink from "../components/PersonLink";
import SafetyMenu from "../components/SafetyMenu";
import { isVisible, useHang, YOU } from "../lib/hangouts";
import { progress, streakWeeks, useProgress } from "../lib/progress";
import { undo } from "../lib/undo";
import { supabase } from "../lib/supabase";
import { watchTables } from "../lib/people";
import { refreshOnReturn } from "../lib/privateDb";

const MAX = 1000;
const initials = (n: string) => n.trim().slice(0, 1).toUpperCase() || "?";
const when = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m}m ago`; if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return new Date(iso).toLocaleDateString();
};

/** Keeps the right column pinned under the search with no scrollbar of its own. If it is ever taller than the window, it rides up until its bottom shows and holds there.
 *  This only moves the column. It never changes what is inside it, so it cannot set off a loop. */
function useStickyRail(ref: React.RefObject<HTMLElement | null>, ready: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !ready) return;
    const place = () => {
      if (getComputedStyle(el).position !== "sticky") return;
      const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--topline-h")) + 8;
      el.style.top = `${Math.min(top, window.innerHeight - el.offsetHeight - 16)}px`;
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    window.addEventListener("resize", place);
    return () => { ro.disconnect(); window.removeEventListener("resize", place); };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
}

export default function Feed() {
  const { session } = useAuth();
  const me = session?.user.id ?? "";
  const name = useDisplayName();

  const [campus, setCampus] = useState<{ name: string; key: string } | null>(null);
  const [posts, setPosts] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [community, setCommunity] = useState<Community>("Everyone");
  const [posting, setPosting] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<"All" | Community>("All");
  const [hangsOpen, setHangsOpen] = useState(() => { try { return localStorage.getItem("orbit-feed-hangs") !== "0"; } catch { return true; } });
  const toggleHangs = () => setHangsOpen((v) => { try { localStorage.setItem("orbit-feed-hangs", v ? "0" : "1"); } catch { /* ignore */ } return !v; });
  const [calOpen, setCalOpen] = useState(() => { try { return localStorage.getItem("orbit-feed-cal") === "1"; } catch { return false; } });
  const toggleCal = () => setCalOpen((v) => { try { localStorage.setItem("orbit-feed-cal", v ? "0" : "1"); } catch { /* ignore */ } return !v; });
  const [day, setDay] = useState<string | null>(null);
  const [hangTab, setHangTab] = useState<"ask" | "going" | "all" | null>(null);
  const hangRow = useRef<HTMLDivElement>(null);
  const staying = useRef<{ tab: string; ids: Map<string, number | null> } | null>(null);
  const [, nudge] = useState(0);

  const rail = useRef<HTMLElement>(null);
  useStickyRail(rail, !loading && !!campus);
  const { groups, hangouts } = useHang();
  const pins = usePins();
  useEffect(() => { const t = setTimeout(() => nudge((n) => n + 1), 1600); return () => clearTimeout(t); }, [hangouts]);
  const pinKey = pins.filter((p) => p.kind === "hangout").map((p) => p.id).join();
  useEffect(() => { hangRow.current?.scrollTo({ left: 0, behavior: "smooth" }); }, [pinKey]);
  const prog = useProgress();
  const weeks = prog.enabled ? streakWeeks(prog) : 0;
  const run = async (fn: () => Promise<void>) => { setError(""); try { await fn(); } catch (e) { notice.show({ icon: "wifi", title: "That did not go through", message: `${(e as Error).message || "Something went wrong."} Check your connection and try again.` }); } };
  const load = () => run(async () => { const c = await api.campus(); setCampus(c); if (c) setPosts(await api.list()); setLoading(false); });
  useEffect(() => { load(); }, []);

  // Posts, comments and likes from other students arrive on their own. Posts you have just deleted (and can still undo) stay out of the way.
  const removing = useRef(new Set<string>());
  useEffect(() => {
    if (!supabase || !campus) return;
    const refresh = () => { api.list().then((rows) => setPosts(rows.filter((r) => !removing.current.has(r.id)))).catch(() => undefined); };
    const stopWatch = watchTables("orbit-feed", ["campus_posts", "post_likes", "post_comments"], refresh);
    const stopReturn = refreshOnReturn(refresh);
    return () => { stopWatch(); stopReturn(); };
  }, [campus?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  // A post made from the sidebar window appears here without a reload.
  useEffect(() => { const again = () => { load(); }; window.addEventListener("orbit-posts-changed", again); return () => window.removeEventListener("orbit-posts-changed", again); }, []);


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
    removing.current.add(p.id);
    setPosts((ps) => ps.filter((x) => x.id !== p.id));
    undo.show("Post deleted", {
      onUndo: () => { removing.current.delete(p.id); setPosts((ps) => (ps.some((x) => x.id === p.id) ? ps : [...ps, p].sort((a, b) => b.created_at.localeCompare(a.created_at)))); },
      commit: () => Promise.resolve(api.remove(p.id)).finally(() => { removing.current.delete(p.id); }),
    });
  };
  // A reply is a comment that points at the comment it answers; the person who wrote that comment is told.
  const sendReply = (p: Row, parentId: string, text: string) => run(async () => { await api.comment(p.id, me, name, text, parentId); progress.log("reply"); await load(); });
  const sendComment = (p: Row, text: string) => run(async () => { await api.comment(p.id, me, name, text); progress.log("reply"); await load(); });

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
  // Nobody reaches Home without a university: onboarding asks for it first.
  if (!campus) return <Navigate to="/onboarding" replace />;

  // Picking a day on the calendar shows that day's reminders and hangouts. It never hides posts from the feed.
  const shown = posts.filter((p) => filter === "All" || p.community === filter);
  const upcoming = hangouts
    .filter((h) => isVisible(h, groups) && new Date(h.when).getTime() > Date.now() - 3 * 3600000)
    .sort((x, y) => x.when.localeCompare(y.when));

  const asking = upcoming.filter((h) => !h.rsvps[YOU]);
  const going = upcoming.filter((h) => h.rsvps[YOU] === "yes");
  const tab = hangTab ?? (asking.length ? "ask" : "all");
  const isPinned = (id: string) => pins.some((p) => p.kind === "hangout" && p.id === id);
  // Pinned hangouts lead the row, and stay in it whichever tab is open.
  const filtered = tab === "ask" ? asking : tab === "going" ? going : upcoming;
  // A card you just answered lingers for a moment so you can see the toggle move, then leaves the tab it no longer belongs to.
  if (!staying.current || staying.current.tab !== tab) staying.current = { tab, ids: new Map() };
  const ids = staying.current.ids;
  filtered.forEach((h) => ids.set(h.id, null));
  ids.forEach((left, id) => { if (left === null && !filtered.some((h) => h.id === id)) ids.set(id, Date.now()); });
  const base = tab === "all" ? upcoming : upcoming.filter((h) => { const left = ids.get(h.id); return left === null || (left !== undefined && Date.now() - left < 1500); });
  const list = [...base].sort((a, b) => Number(isPinned(b.id)) - Number(isPinned(a.id)));
  const tabs = [{ id: "ask", label: "Needs your answer", n: asking.length }, { id: "going", label: "You're going", n: going.length }, { id: "all", label: "All", n: upcoming.length }] as const;
  const scrollHangs = (dir: number) => hangRow.current?.scrollBy({ left: dir * (hangRow.current.clientWidth * 0.9), behavior: "smooth" });

  return (
    <div className="feed-layout">
      <div className="feed-main">
        <h1 className="sr">Campus feed</h1>
        <section className="hangs" aria-label="Hangouts">
          <header>
            <h2 className="sr">Hangouts</h2>
            {upcoming.length > 0 && !hangsOpen && (
              <button type="button" className="hang-sum" aria-expanded={false} onClick={toggleHangs}>
                {asking.length > 0 && <span className="hang-dot" aria-hidden="true" />}
                <span>{upcoming.length} hangout{upcoming.length === 1 ? "" : "s"}{asking.length > 0 && <> · <b>{asking.length} need{asking.length === 1 ? "s" : ""} your answer</b></>}</span>
                {upcoming.filter((h) => isPinned(h.id)).slice(0, 2).map((h) => <span key={h.id} className="hang-sum-pin"><Pin size={12} fill="currentColor" aria-hidden="true" />{h.title}</span>)}
              </button>
            )}
            {upcoming.length > 0 && hangsOpen && (
              <div className="hang-tabs" role="tablist" aria-label="Filter hangouts">
                {tabs.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} data-ask={t.id === "ask" && t.n > 0 ? "1" : undefined} onClick={() => { setHangTab(t.id); hangRow.current?.scrollTo({ left: 0 }); }}>{t.label}<b>{t.n}</b></button>)}
              </div>
            )}
            <div className="hangs-actions">
              {upcoming.length > 0 && hangsOpen && (
                <div className="hang-nav">
                  <button type="button" aria-label="Scroll hangouts back" onClick={() => scrollHangs(-1)}><ChevronLeft size={18} /></button>
                  <button type="button" aria-label="Scroll hangouts forward" onClick={() => scrollHangs(1)}><ChevronRight size={18} /></button>
                </div>
              )}
              {weeks > 0 && <span className="streak-chip" aria-label={`${weeks} week streak`}><Flame size={16} strokeWidth={1.75} aria-hidden="true" />{weeks} week{weeks === 1 ? "" : "s"}</span>}
              <Link to="/app/groups" className="pill-link">Plan one</Link>
              {upcoming.length > 0 && <button type="button" className="hang-fold" aria-expanded={hangsOpen} aria-label={hangsOpen ? "Collapse hangouts" : "Expand hangouts"} onClick={toggleHangs}><ChevronUp size={18} aria-hidden="true" style={{ transform: hangsOpen ? "none" : "rotate(180deg)", transition: "transform .25s" }} /></button>}
            </div>
          </header>
          {upcoming.length === 0 ? (
            <div className="hang-empty">
              <p className="muted">No hangouts planned. Start a group with friends, then plan one from the chat.</p>
              <Link to="/app/groups" className="btn primary">Go to groups</Link>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {hangsOpen && (
                <motion.div key="hangs-body" className="hangs-body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1, transition: enter }} exit={{ height: 0, opacity: 0, transition: exit }}>
              {list.length === 0
                ? <p className="muted hang-none">{tab === "ask" ? "You're all caught up. Nothing needs an answer." : "Nothing here yet."}</p>
                : <div key={tab} className={"hang-row" + (list.some((h) => isPinned(h.id)) ? " has-pins" : "")} ref={hangRow}>
                    <AnimatePresence mode="popLayout" initial={false}>
                      {list.map((h, i) => (
                        <motion.div key={h.id} className="hang-slot" layout="position" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1, transition: enter }} exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.18 } }}>
                          <HangoutCard h={h} group={groups.find((g) => g.id === h.groupId)?.name ?? ""} tone={i} />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </section>
        <form className={"card post composer" + (body ? " has-text" : "")} onSubmit={publish}>
          <label className="field">
            <span className="sr">Write a post</span>
            <textarea ref={composerRef} id="composer" rows={1} maxLength={MAX} value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} placeholder="What’s happening on campus?" />
          </label>
          <div className="composer-row">
            <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span id="post-to">Post to</span>
              <CommunityPicker value={community} onChange={setCommunity} labelledBy="post-to" />
            </div>
            <EmojiButton value={body} onChange={setBody} inputRef={composerRef} max={MAX} />
            <span className={"count" + (body.length > MAX * 0.9 ? " warn" : "")} aria-live="polite">{body.length}/{MAX}</span>
            <button className="btn primary" disabled={posting || !body.trim()}>{posting ? "Posting…" : "Post"}</button>
          </div>
        </form>
        <h2 className="sr">Campus feed at {campus.name}</h2>
        <div className="pills" role="group" aria-label="Filter by community">
          {(["All", ...communities] as const).map((c) => {
            const { Icon, ink } = communityIcon[c];
            return (
              <button key={c} type="button" className="pill" aria-pressed={filter === c} onClick={() => setFilter(c)}>
                <span className="dot" style={{ color: ink }}><Icon size={16} strokeWidth={1.9} aria-hidden="true" /></span>{c}
              </button>
            );
          })}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="posts">
          {shown.length === 0 && <p className="empty">{posts.length === 0 ? "No posts yet. Be the first." : `Nothing in ${filter} yet.`}</p>}
          <AnimatePresence initial={false}>
            {shown.map((p) => {
              const liked = p.post_likes.some((l) => l.user_id === me);
              const expanded = open === p.id;
              const people = [...new Set(p.post_comments.map((c) => c.author_name))].slice(0, 3);
              return (
                <motion.article key={p.id} layout="position" className="card post tile" data-c={p.community} initial={{ opacity: 0, y: -14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1, transition: enter }} exit={{ opacity: 0, transition: exit }} transition={enter}>
                  <div className="meta"><span className="who"><PersonLink id={p.author_id} className="who-link"><span className="who-av" aria-hidden="true">{initials(p.author_name)}</span></PersonLink><span><PersonLink id={p.author_id} className="who-link"><strong style={{ color: "var(--ink)" }}>{p.author_name}</strong></PersonLink> · {when(p.created_at)}</span></span><span className="meta-end"><span className="chip">{p.community}</span><SafetyMenu userId={p.author_id} name={p.author_name} postId={p.id} context="post" /></span></div>
                  {p.payload.title && <h3>{p.payload.title}</h3>}
                  <p className="body" style={{ whiteSpace: "pre-wrap" }}>{p.payload.body ?? p.payload.text ?? ""}</p>
                  <div className="foot">
                    {people.length > 0 && <span className="avatars" aria-hidden="true">{people.map((n) => <span key={n}>{initials(n)}</span>)}</span>}
                    <div className="actions" style={{ width: "auto", marginLeft: "auto" }}>
                      <motion.button whileTap={{ scale: 0.88 }} className="iconbtn" aria-pressed={liked} aria-label={liked ? "Unlike" : "Like"} onClick={() => like(p)}>
                        <motion.span key={liked ? "on" : "off"} style={{ display: "inline-flex" }} initial={liked ? { scale: 0.7 } : false} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 22 }}><Heart size={16} fill={liked ? "currentColor" : "none"} /></motion.span>{p.post_likes.length}
                      </motion.button>
                      <button className="iconbtn" aria-expanded={expanded} aria-label="Comments" onClick={() => setOpen(expanded ? null : p.id)}>
                        <MessageCircle size={16} />{p.post_comments.length}
                      </button>
                      {p.author_id === me && <button className="iconbtn" aria-label="Delete post" onClick={() => remove(p)}><Trash2 size={16} /></button>}
                    </div>
                  </div>
                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div className="reveal" key="comments" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1, transition: enter }} exit={{ height: 0, opacity: 0, transition: exit }}>
                        <div className="comments">
                          <CommentThread postId={p.id} comments={p.post_comments} onComment={(text) => sendComment(p, text)} onReply={(parentId, text) => sendReply(p, parentId, text)} />
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
      <aside className="rail" ref={rail} aria-label="Your campus summary">
        <section className="cal-fold">
          <button type="button" className="cal-toggle" aria-expanded={calOpen} onClick={toggleCal}>
            <span className="cal-ico"><CalendarDays size={18} strokeWidth={1.75} /></span>
            <span>Calendar{day ? " · 1 day selected" : ""}</span>
            <ChevronDown size={18} className="cal-chev" />
          </button>
          <AnimatePresence initial={false}>
            {calOpen && (
              <motion.div key="cal" className="reveal" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1, transition: enter }} exit={{ height: 0, opacity: 0, transition: exit }}>
                <Calendar posts={posts} day={day} onDay={setDay} compact />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
        <UpcomingList limit={5} moreTo="/app/plans" hide={["hangout"]} title="Reminders and chores" />
      </aside>
    </div>
  );
}
