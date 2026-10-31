import { Suspense, lazy, useEffect, useRef, useState, type FormEvent } from "react";
import { useIsPhone } from "../lib/phone";
import EmojiButton from "../components/EmojiButton";
import RichText from "../components/RichText";
import CampusSoon from "../components/CampusSoon";
import NowHeader from "../components/NowHeader";
import PlansWaiting from "../components/PlansWaiting";
import { MomentsBar } from "../components/Moments";
import { useDisplayName } from "../lib/displayName";
import { AnimatePresence, motion } from "framer-motion";
import { Navigate, useSearchParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useAuth } from "../lib/auth";
import { feedApi as api, type Row } from "../lib/feedData";
import { communities, type Community } from "../shared/feed";
import { enter, exit } from "../lib/motion";
// The calendar is only used on a larger screen, so it is loaded only there.
const Calendar = lazy(() => import("../components/Calendar"));
import UpcomingList from "../components/UpcomingList";
import CommunityPicker from "../components/CommunityPicker";
import ShareMenu from "../components/ShareMenu";
import { siteUrl } from "../lib/siteUrl";
import { notice } from "../lib/notice";
import CommentThread from "../components/CommentThread";
import PersonLink from "../components/PersonLink";
import SafetyMenu from "../components/SafetyMenu";
import { progress } from "../lib/progress";
import { undo } from "../lib/undo";
import { supabase } from "../lib/supabase";
import { useVerified } from "../lib/verified";
import { watchTables } from "../lib/people";
import { refreshOnReturn } from "../lib/privateDb";
import { ago } from "../lib/dayWords";
import { gradientFor } from "../lib/look";

const MAX = 1000;
/** What each audience is called on the page. "Everyone" is the open one; "Marketplace" is things for sale, not a group of people. */
const SHOW: Record<string, string> = { All: "Everything", Everyone: "Open to all", Commuters: "Commuters", Residents: "Residents", Roommates: "Roommates", Marketplace: "For sale" };
const audience = (c: string) => (c === "Marketplace" ? "sale" : c === "Everyone" ? "everyone" : c.toLowerCase());
/** The feed asks for this many posts, so this is also where it says it has stopped. */
const PAGE = 50;
const initials = (n: string) => n.trim().slice(0, 1).toUpperCase() || "?";

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
  const isVerified = useVerified();
  const { session } = useAuth();
  const me = session?.user.id ?? "";
  const name = useDisplayName();

  const [campus, setCampus] = useState<{ name: string; key: string } | null>(null);
  const [posts, setPosts] = useState<Row[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [community, setCommunity] = useState<Community>("Everyone");
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState("");
  const [sharing, setSharing] = useState<Row | null>(null);
  const [sp] = useSearchParams();
  const target = sp.get("post");
  // The assistant has its own button up here, so its floating one steps out of the way on this page.
  useEffect(() => { document.body.classList.add("feed-page"); return () => document.body.classList.remove("feed-page"); }, []);
  // A shared link opens the feed at that post.
  useEffect(() => {
    if (!target || loading) return;
    const el = document.getElementById(`post-${target}`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("flash");
    const t = window.setTimeout(() => el.classList.remove("flash"), 2400);
    return () => window.clearTimeout(t);
  }, [target, loading, posts.length]);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<"All" | Community>("All");
  // Writing a post while looking at one audience posts to that audience.
  const pick = (c: "All" | Community) => { setFilter(c); if (c !== "All") setCommunity(c); };
  const [calOpen, setCalOpen] = useState(() => { try { return localStorage.getItem("orbit-feed-cal") === "1"; } catch { return false; } });
  const toggleCal = () => setCalOpen((v) => { try { localStorage.setItem("orbit-feed-cal", v ? "0" : "1"); } catch { /* ignore */ } return !v; });
  const [day, setDay] = useState<string | null>(null);

  const phone = useIsPhone();
  const rail = useRef<HTMLElement>(null);
  useStickyRail(rail, !loading && !!campus);
  const run = async (fn: () => Promise<void>) => { try { await fn(); } catch (e) { notice.show({ icon: "wifi", title: "That did not go through", message: `${(e as Error).message || "Something went wrong."} Check your connection and try again.` }); } };
  const load = async () => {
    try { const c = await api.campus(); setCampus(c); if (c) setPosts(await api.list()); setFailed(false); }
    catch { setFailed(true); }
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

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
  useEffect(() => { const again = () => { void load(); }; window.addEventListener("orbit-posts-changed", again); return () => window.removeEventListener("orbit-posts-changed", again); }, []);

  async function publish(e: FormEvent) {
    e.preventDefault();
    const text = body.trim(); if (!campus || !text) return;
    setPosting(true);
    await run(async () => { await api.publish({ id: crypto.randomUUID(), campus_key: campus.key, author_id: me, author_name: name, community, body: text }); progress.log("post"); setBody(""); await load();
      setPosted(filter !== "All" && filter !== community ? `Posted for ${audience(community)}. Switch to Everything to see it.` : `Posted for ${audience(community)}. It is at the top of the list below.`);
      window.setTimeout(() => setPosted(""), 8000);
    });
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
          <div className="skeleton sk-now" />
          <div className="skeleton sk-line" />
          <div className="skeleton sk-composer" />
          <div className="posts ruled">{[0, 1, 2].map((i) => <div key={i} className="skeleton sk-post" />)}</div>
        </div>
      </div>
    );
  if (failed && !campus)
    return (
      <div className="feed-layout"><div className="feed-main">
        <div className="feed-failed" role="alert">
          <h2>Couldn’t load your campus feed</h2>
          <p>Nothing you wrote is lost. Check your connection and try again.</p>
          <button type="button" className="btn primary" onClick={() => { setLoading(true); void load(); }}>Try again</button>
        </div>
      </div></div>
    );
  // Nobody reaches Home without a university: onboarding asks for it first.
  if (!campus) return <Navigate to="/onboarding" replace />;

  // Reposts are kept on your profile, not repeated in the feed.
  const feed = posts.filter((p) => !p.payload.repostOf);
  const countFor = (c: "All" | Community) => (c === "All" ? feed.length : feed.filter((p) => p.community === c).length);
  const shown = feed.filter((p) => filter === "All" || p.community === filter);
  const repliedBy = (p: Row) => {
    const names = [...new Set(p.post_comments.map((c) => c.author_name))];
    if (names.length === 0) return "";
    const first = names[0].split(" ")[0];
    return names.length === 1 ? `${first} replied` : names.length === 2 ? `${first} and ${names[1].split(" ")[0]} replied` : `${first} and ${names.length - 1} others replied`;
  };

  return (
    <div className="feed-layout">
      <div className="feed-main">
        <h1 className="sr">Campus feed</h1>
        <NowHeader />
        <MomentsBar />
        <PlansWaiting />
        <CampusSoon />
        {phone && <UpcomingList limit={3} moreTo="/app/plans" hide={["hangout"]} title="On your list" />}
        {!phone && <form className={"composer" + (body ? " has-text" : "")} onSubmit={publish}>
          <label className="field">
            <span className="sr">Write a post</span>
            <textarea ref={composerRef} id="composer" rows={1} maxLength={MAX} value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} placeholder={`Lost a lanyard? Found a seat? Tell ${campus.name}.`} />
          </label>
          <div className="composer-row">
            <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span id="post-to">Post to</span>
              <CommunityPicker value={community} onChange={setCommunity} labelledBy="post-to" />
            </div>
            <EmojiButton value={body} onChange={setBody} inputRef={composerRef} max={MAX} />
            {body.length > MAX * 0.8 ? <span className={"count" + (body.length > MAX * 0.9 ? " warn" : "")} aria-live="polite">{body.length}/{MAX}</span> : <span className="composer-hint">Ctrl+Enter posts</span>}
            <button className="btn primary" disabled={posting || !body.trim()}>{posting ? "Posting…" : "Post"}</button>
          </div>
        </form>}
        {posted && <p className="composer-note" role="status">{posted}</p>}
        <h2 className="feed-h">{campus.name}<span>What students are saying</span></h2>
        <div className="pills">
          <nav className="frow" aria-label="Show posts">
            <span className="frow-l" title={`Counts are for the newest ${PAGE} posts`}>Show</span>
            {(["All", ...communities] as const).map((c) => (
              <button key={c} type="button" aria-pressed={filter === c} disabled={countFor(c) === 0 && filter !== c} onClick={() => pick(c)}>{SHOW[c]}<small>{countFor(c)}</small></button>
            ))}
          </nav>
        </div>
        {sharing && <ShareMenu text={sharing.payload.body ?? sharing.payload.text ?? ""} author={sharing.author_name} url={`${siteUrl()}/app/feed?post=${sharing.id}`} onClose={() => setSharing(null)} />}
        <div className="posts ruled">
          {shown.length === 0 && (
            <div className="feed-empty">
              {feed.length === 0 ? (
                <>
                  <p>Nobody has posted at {campus.name} yet. Say what you saw on the way to class.</p>
                  <button type="button" className="btn primary" onClick={() => composerRef.current?.focus()}>Write the first post</button>
                </>
              ) : (
                <>
                  <p>Nothing {filter === "Marketplace" ? "for sale" : `for ${audience(filter)}`} yet. Ask where to park, or when the shuttle runs.</p>
                  <div className="feed-empty-acts">
                    <button type="button" className="btn primary" onClick={() => { setCommunity(filter as Community); composerRef.current?.focus(); }}>Post {filter === "Marketplace" ? "something for sale" : `for ${audience(filter)}`}</button>
                    <button type="button" className="btn" onClick={() => setFilter("All")}>Show everything</button>
                  </div>
                </>
              )}
            </div>
          )}
          {shown.map((p) => {
            const liked = p.post_likes.some((l) => l.user_id === me);
            const expanded = open === p.id;
            const subject = (p.payload.title ?? p.payload.body ?? p.payload.text ?? "").slice(0, 40);
            const replies = p.post_comments.length;
            return (
              <article key={p.id} id={`post-${p.id}`} className="rp" aria-label={`Post by ${p.author_name}`}>
                <PersonLink id={p.author_id} className="rp-avlink" decorative><span className="rp-av" style={{ background: gradientFor(p.author_name) }} aria-hidden="true">{initials(p.author_name)}</span></PersonLink>
                <div className="rp-main">
                  <div className="rp-head">
                    <PersonLink id={p.author_id} className="rp-name"><strong>{p.author_name}</strong></PersonLink>
                    {isVerified(p.author_id) && <span className="rp-tag">Campus staff</span>}
                    <span className="rp-time">{ago(p.created_at)}</span>
                    {p.community !== "Everyone" && <span className="rp-aud">For {audience(p.community)}</span>}
                    <SafetyMenu userId={p.author_id} name={p.author_name} postId={p.id} context="post" />
                  </div>
                  {p.payload.title && <h3 className="rp-title">{p.payload.title}</h3>}
                  <p className="rp-body"><RichText text={p.payload.body ?? p.payload.text ?? ""} /></p>
                  <div className="rp-acts">
                    <button type="button" aria-expanded={expanded} aria-label={`Replies to “${subject}”`} onClick={() => setOpen(expanded ? null : p.id)}>Reply{replies > 0 ? ` · ${replies}` : ""}</button>
                    <button type="button" aria-pressed={liked} aria-label={`Like “${subject}”`} onClick={() => like(p)}>{liked ? "Liked" : "Like"}{p.post_likes.length > 0 ? ` · ${p.post_likes.length}` : ""}</button>
                    <button type="button" aria-label={`Share “${subject}”`} onClick={() => setSharing(p)}>Share</button>
                    {p.author_id === me && <button type="button" aria-label={`Delete “${subject}”`} onClick={() => remove(p)}>Delete</button>}
                    {repliedBy(p) && <span className="rp-who">{repliedBy(p)}</span>}
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
                </div>
              </article>
            );
          })}
          {feed.length >= PAGE && filter === "All" && <p className="feed-end">That’s the newest {PAGE} posts. Older ones aren’t shown.</p>}
        </div>
      </div>
      {!phone && <aside className="rail" ref={rail} aria-label="Your campus summary">
        <UpcomingList limit={5} moreTo="/app/plans" hide={["hangout"]} title="On your list" />
        <section className="cal-fold">
          <button type="button" className="cal-toggle" aria-expanded={calOpen} onClick={toggleCal}>
            <span>Calendar{day ? " · 1 day selected" : ""}</span>
            <ChevronDown size={18} aria-hidden="true" style={{ transform: calOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
          </button>
          <AnimatePresence initial={false}>
            {calOpen && (
              <motion.div key="cal" className="reveal" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1, transition: enter }} exit={{ height: 0, opacity: 0, transition: exit }}>
                <Suspense fallback={<div className="skeleton sk-card" />}><Calendar posts={posts} day={day} onDay={setDay} compact /></Suspense>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </aside>}
    </div>
  );
}
