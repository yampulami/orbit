import { isTyping } from "../lib/shortcuts";
import PersonName from "../components/PersonName";
import { spoken, useLiveNames } from "../lib/directory";
import { AttachButton, AttachPreview, useAttachment } from "../components/Attach";
import Avatar from "../components/Avatar";
import { Fragment, Suspense, lazy, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
import { Check, ChevronDown, Heart, MessageCircle, Pencil, Repeat2, Send, Trash2 } from "lucide-react";
import QuoteCard from "../components/QuoteCard";
import { useAuth } from "../lib/auth";
import { feedApi as api, type Row } from "../lib/feedData";
import { communities, type Community } from "../shared/feed";
import { enter, exit } from "../lib/motion";
// The calendar is only used on a larger screen, so it is loaded only there.
const Calendar = lazy(() => import("../components/Calendar"));
import UpcomingList from "../components/UpcomingList";
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
import { loadProfile } from "../lib/profile";
import { useFriends } from "../lib/friends";
import { REPOST_HOURS, rankFeed } from "../lib/feedRank";
import { loadSignals, recordSignal } from "../lib/feedSignals";

const MAX = 1000;
/** What each audience is called on the page. "Everyone" is the open one; "Marketplace" is things for sale, not a group of people. */
const SHOW: Record<string, string> = { Mine: "For you", All: "Everything", Everyone: "Open to all", Commuters: "Commuters", Residents: "Residents", Roommates: "Roommates", Marketplace: "For sale" };
/** What each audience means, said when you open the list. */
const WHO: Record<string, string> = {
  Everyone: "Everyone at your university can see it.",
  Commuters: "Only students who live off campus see it.",
  Residents: "Only students who live in residence see it.",
  Roommates: "Only your roommates see it.",
  Marketplace: "Shows up as something for sale or to give away.",
};
/** The posts meant for this student: open ones, things for sale, and the group they belong to. A commuter is not handed dorm notices, and a resident is not handed shuttle delays. */
const FOR_YOU: Record<string, string[]> = {
  residence: ["Everyone", "Marketplace", "Residents", "Roommates"],
  commute: ["Everyone", "Marketplace", "Commuters"],
  "off-campus": ["Everyone", "Marketplace", "Commuters"],
};
type Filter = "All" | "Mine" | Community;
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
  const draftKey = `orbit-feed-draft:${me}`;
  const att = useAttachment(4); // up to four photos per post
  const [body, setBody] = useState(() => { try { return localStorage.getItem(`orbit-feed-draft:${session?.user.id ?? ""}`) ?? ""; } catch { return ""; } });
  // A half-written post survives leaving the page or closing the tab.
  useEffect(() => { try { if (body) localStorage.setItem(draftKey, body); else localStorage.removeItem(draftKey); } catch { /* storage unavailable */ } }, [body, draftKey]);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [community, setCommunity] = useState<Community>("Everyone");
  const [choosing, setChoosing] = useState(false); // the audience list opens only when asked; the box says who it is for
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState("");
  const [sharing, setSharing] = useState<Row | null>(null);
  // Quoting: the post being quoted shows above the box, and the new post points at it. Quoted posts that are not in the newest list are fetched by id.
  const [quoting, setQuoting] = useState<Row | null>(null);
  const [fetched, setFetched] = useState<Record<string, Row | null>>({});
  // The repost button opens a small menu, like X: Repost (or Undo repost) and Quote.
  const [repostFor, setRepostFor] = useState<string | null>(null);
  useEffect(() => {
    if (!repostFor) return;
    const away = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest?.(".rp-rep")) setRepostFor(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setRepostFor(null); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [repostFor]);
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
  // Keys for the post list: j and k move between posts, l likes, r opens the replies. (After "g" a letter is a page jump, so those are left alone.)
  useEffect(() => {
    let lastG = 0;
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || isTyping(document.activeElement)) return;
      const k = e.key.toLowerCase();
      if (k === "g") { lastG = Date.now(); return; }
      if (k.length !== 1 || !"jklr".includes(k) || Date.now() - lastG < 1200 || document.querySelector(".gs-overlay")) return;
      const posts = [...document.querySelectorAll<HTMLElement>("article.rp")];
      if (posts.length === 0) return;
      const here = (document.activeElement as HTMLElement | null)?.closest("article.rp") as HTMLElement | null;
      if (k === "j" || k === "k") {
        e.preventDefault();
        const at = here ? posts.indexOf(here) : -1;
        const next = posts[k === "j" ? Math.min(at + 1, posts.length - 1) : Math.max(at < 0 ? 0 : at - 1, 0)];
        next.focus();
        next.scrollIntoView({ block: "nearest" });
        return;
      }
      if (!here) return;
      e.preventDefault();
      here.querySelector<HTMLElement>(k === "l" ? "button[aria-pressed]" : "button[aria-expanded]")?.click();
      if (k === "r") window.setTimeout(() => here.querySelector<HTMLElement>(".comments textarea, .comments input")?.focus(), 450);
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);
  useEffect(() => {
    if (!choosing) return;
    const away = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest?.(".aud-wrap")) setChoosing(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [choosing]);
  const [open, setOpen] = useState<string | null>(null);
  const profile = loadProfile(me);
  const living = profile?.living;
  const { friends } = useFriends();
  // What this student has liked, replied to and reposted, read once per visit so the order holds still while they read.
  const [signals] = useState(() => loadSignals(me));
  const mineTags = FOR_YOU[living ?? ""] ?? null; // null when we do not know how they live: then there is nothing to tailor to
  const [filter, setFilter] = useState<Filter>(mineTags ? "Mine" : "All");
  // Writing a post while looking at one audience posts to that audience.
  const pick = (c: Filter) => { setFilter(c); if (c !== "All" && c !== "Mine") setCommunity(c); };
  const [calOpen, setCalOpen] = useState(() => { try { return localStorage.getItem("orbit-feed-cal") === "1"; } catch { return false; } });
  const toggleCal = () => setCalOpen((v) => { try { localStorage.setItem("orbit-feed-cal", v ? "0" : "1"); } catch { /* ignore */ } return !v; });
  const [day, setDay] = useState<string | null>(null);

  const phone = useIsPhone();
  /** Start a post. On a phone the post box is the new-post window the shell owns, so ask it to open (naming who it is for). */
  const startPost = (c?: Community) => {
    if (phone) { window.dispatchEvent(new CustomEvent("orbit-compose", { detail: { community: c } })); return; }
    if (c) setCommunity(c);
    composerRef.current?.focus();
  };
  /** Quote a post: on a phone the new-post window opens with it; on a computer the box on this page takes it. */
  const startQuote = (p: Row) => {
    if (phone) { window.dispatchEvent(new CustomEvent("orbit-compose", { detail: { quote: p } })); return; }
    setQuoting(p);
    composerRef.current?.focus();
    composerRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  const rail = useRef<HTMLElement>(null);
  useStickyRail(rail, !loading && !!campus);
  const run = async (fn: () => Promise<void>) => { try { await fn(); } catch (e) { notice.show({ icon: "wifi", title: "That did not go through", message: `${(e as Error).message || "Something went wrong."} Check your connection and try again.` }); } };
  const load = async () => {
    try { const c = await api.campus(); setCampus(c); if (c) setPosts(await api.list()); setFailed(false); }
    catch { setFailed(true); }
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const have = new Set(posts.map((p) => p.id));
    const friendIds = new Set(friends.map((f) => f.id));
    const fresh = posts.filter((p) => p.payload.repostOf && (friendIds.has(p.author_id) || p.author_id === me) && Date.now() - Date.parse(p.created_at) <= REPOST_HOURS * 3_600_000).map((p) => p.payload.repostOf);
    const want = [...new Set([...posts.map((p) => p.payload.quote?.id), ...fresh].filter((id): id is string => !!id && !have.has(id) && !(id in fetched)))];
    if (want.length === 0) return;
    let alive = true;
    api.byIds(want).then((rows) => { if (alive) setFetched((f) => { const next = { ...f }; for (const id of want) next[id] = rows.find((r) => r.id === id) ?? null; return next; }); }).catch(() => undefined);
    return () => { alive = false; };
  }, [posts, friends]); // eslint-disable-line react-hooks/exhaustive-deps
  /** The post a quote points at: undefined while it is being looked up, null when it is gone. */
  const quotedRow = (id: string): Row | null | undefined => posts.find((x) => x.id === id) ?? (id in fetched ? fetched[id] : undefined);
  // The order of the feed. "For you" is ranked (friends' reposts, friends, your interests, what you have engaged with); everything else is newest first.
  // It is worked out when the set of posts changes, not on every like, so posts do not jump around while you read. The posts shown are always the current ones.
  const orderKey = `${filter === "Mine" ? "r" : "l"}|${posts.map((p) => p.id).join(",")}|${Object.keys(fetched).join(",")}|${friends.map((f) => f.id).join(",")}`;
  const order = useMemo(() => rankFeed({
    rows: posts, lookup: (id) => fetched[id], now: Date.now(), me, friends: new Set(friends.map((f) => f.id)),
    interests: profile?.interests ?? [], signals, mode: filter === "Mine" ? "forYou" : "latest",
  }).map((it) => ({ id: it.row.id, repostedBy: it.repostedBy })), [orderKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const text = att.compose(body).trim(); if (!campus || !text) return;
    setPosting(true);
    await run(async () => { await api.publish({ id: crypto.randomUUID(), campus_key: campus.key, author_id: me, author_name: name, community, body: text, ...(quoting ? { quote: quoting.id } : {}) }); if (quoting) recordSignal(me, quoting, "quote"); setQuoting(null); progress.log("post"); setBody(""); att.clear(); setChoosing(false); await load();
      setPosted(filter !== "All" && filter !== "Mine" && filter !== community ? `Posted for ${audience(community)}. Switch to Everything to see it.` : `Posted for ${audience(community)}. It is at the top of the list below.`);
      window.setTimeout(() => setPosted(""), 8000);
    });
    setPosting(false);
  }

  async function like(p: Row) {
    const liked = p.post_likes.some((l) => l.user_id === me);
    if (!liked) recordSignal(me, p, "like");
    setPosts((ps) => ps.map((x) => x.id !== p.id ? x : { ...x, post_likes: liked ? x.post_likes.filter((l) => l.user_id !== me) : [...x.post_likes, { user_id: me }] }));
    await run(() => api.like(p.id, me, !liked));
  }

  /** Repost: a copy of the post kept on your profile (Reposts tab), pointing at the original. It can be undone from here or from your profile. */
  const myRepostOf = (p: Row) => posts.find((r) => r.author_id === me && r.payload.repostOf === p.id);
  const unrepost = (id: string) => run(async () => { await api.remove(id); await load(); });
  const repost = (p: Row) => {
    const had = myRepostOf(p);
    if (had) { void unrepost(had.id); return; }
    if (!campus) return;
    const id = crypto.randomUUID();
    recordSignal(me, p, "repost");
    void run(async () => {
      await api.publish({ id, campus_key: campus.key, author_id: me, author_name: name, community: p.community, body: p.payload.body ?? p.payload.text ?? "", repostOf: p.id, repostName: p.author_name });
      await load();
      undo.show(`Reposted ${p.author_name}’s post`, { onUndo: () => { void unrepost(id); }, commit: () => {} });
    });
  };
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
  const sendReply = (p: Row, parentId: string, text: string) => run(async () => { recordSignal(me, p, "reply"); await api.comment(p.id, me, name, text, parentId); progress.log("reply"); await load(); });
  const sendComment = (p: Row, text: string) => run(async () => { recordSignal(me, p, "reply"); await api.comment(p.id, me, name, text); progress.log("reply"); await load(); });

  if (loading)
    return (
      <div className="feed-layout" aria-busy="true" aria-label="Loading your feed">
        <div className="feed-main">
          <div className="skeleton sk-now" />
          <div className="skeleton sk-line" />
          <div className="skeleton sk-composer" />
          <div className="posts ruled" id="posts" tabIndex={-1}>{[0, 1, 2].map((i) => <div key={i} className="skeleton sk-post" />)}</div>
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
  const isMine = (p: Row) => !mineTags || mineTags.includes(p.community);
  const countFor = (c: Filter) => (c === "All" ? feed.length : c === "Mine" ? feed.filter(isMine).length : feed.filter((p) => p.community === c).length);
  const rowOf = (id: string) => posts.find((x) => x.id === id) ?? fetched[id] ?? undefined;
  const shown = order
    .map((o) => ({ row: rowOf(o.id), repostedBy: o.repostedBy }))
    .filter((x): x is { row: Row; repostedBy: { id: string; name: string }[] } => !!x.row && (filter === "All" || (filter === "Mine" ? isMine(x.row) : x.row.community === filter)));
  /** "Jordan reposted", "Jordan and Lee reposted", "Jordan and 2 others reposted". */
  const repostLine = (by: { id: string; name: string }[]) => {
    const n = by.map((b) => (b.id === me ? "You" : b.name.split(" ")[0]));
    return `${n.length === 1 ? n[0] : n.length === 2 ? `${n[0]} and ${n[1]}` : `${n[0]} and ${n.length - 1} others`} reposted`;
  };
  return (
    <div className="feed-layout">
      <div className="feed-main">
        <h1 className="sr">Campus feed</h1>
        {!phone && <nav className="skip-row" aria-label="Skip within the feed"><a className="skip" href="#posts" onClick={(e) => { e.preventDefault(); document.getElementById("posts")?.focus(); }}>Skip to posts</a><a className="skip" href="#your-list" onClick={(e) => { e.preventDefault(); document.getElementById("your-list")?.focus(); }}>Skip to your list</a></nav>}
        <NowHeader />
        {!phone && <form className={"composer" + (body || att.has ? " has-text" : "")} onSubmit={publish}>
          <label className="field">
            <span className="sr">Write a post</span>
            <textarea ref={composerRef} id="composer" rows={1} maxLength={MAX} value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } else if (e.key === "Escape") { if (choosing) setChoosing(false); else e.currentTarget.blur(); } }} placeholder={quoting ? "Add your comment" : `Lost a lanyard? Found a seat? Tell ${campus.name}.`} />
          </label>
          {quoting && <QuoteCard row={quoting} onRemove={() => setQuoting(null)} />}
          <AttachPreview a={att} />
          <div className="composer-row">
            <div className="aud-wrap" onKeyDown={(e) => { if (e.key === "Escape" && choosing) { e.stopPropagation(); setChoosing(false); (e.currentTarget.querySelector(".aud-trigger") as HTMLElement | null)?.focus(); } }}>
              <button type="button" className="aud-trigger" aria-haspopup="true" aria-expanded={choosing} title={WHO[community]} onClick={() => setChoosing((v) => !v)}>
                <span>Audience</span> <b>{SHOW[community]}</b> <ChevronDown size={16} aria-hidden="true" style={{ transform: choosing ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
              </button>
              {choosing && (
                <div className="audience choosing" role="radiogroup" aria-label="Post to">
                  {communities.filter((c) => c !== "Marketplace").map((c) => <button key={c} type="button" role="radio" aria-checked={community === c} onClick={() => { setCommunity(c); setChoosing(false); composerRef.current?.focus(); }}>{SHOW[c]}{community === c && <Check size={14} aria-hidden="true" />}</button>)}
                  {communities.includes("Marketplace") && <><span className="sep" aria-hidden="true" /><button type="button" role="radio" aria-checked={community === "Marketplace"} title={WHO.Marketplace} onClick={() => { setCommunity("Marketplace"); setChoosing(false); composerRef.current?.focus(); }}>{SHOW.Marketplace}{community === "Marketplace" && <Check size={14} aria-hidden="true" />}</button></>}
                  <small className="aud-who">{WHO[community]}</small>
                </div>
              )}
            </div>
            <EmojiButton value={body} onChange={setBody} inputRef={composerRef} max={MAX} />
            <AttachButton a={att} />
            {body.length > MAX * 0.8 ? <span className={"count" + (body.length > MAX * 0.9 ? " warn" : "")} aria-live="polite">{body.length}/{MAX}</span> : <span className="composer-hint">Ctrl+Enter to post</span>}
            <button className="btn primary" disabled={posting || (!body.trim() && !att.has)}>{posting ? "Posting…" : community === "Everyone" ? "Post" : community === "Marketplace" ? "Post for sale" : `Post to ${SHOW[community]}`}</button>
          </div>
        </form>}
        {posted && <p className="composer-note" role="status">{posted}</p>}
        <MomentsBar />
        <PlansWaiting />
        {phone ? <CampusSoon /> : <div className="cs-narrow"><CampusSoon /></div>}
        {phone && <UpcomingList limit={3} moreTo="/app/plans" hide={["hangout"]} title="On your list" />}
        <h2 className="feed-h">{campus.name}<span>{feed.length >= PAGE ? `Newest ${PAGE} posts` : "What students are saying"}</span></h2>
        <div className="pills">
          <nav className="frow" aria-label="Show posts">
            <span className="frow-l" title={`Counts are for the newest ${PAGE} posts`}>Showing</span>
            {([...(mineTags ? ["Mine"] : []), "All", ...communities] as Filter[]).map((c) => (
              <Fragment key={c}>
              {c === "Marketplace" && <span className="sep" aria-hidden="true" />}
              <button type="button" aria-pressed={filter === c} disabled={countFor(c) === 0 && filter !== c} onClick={() => pick(c)}>{SHOW[c]}<small>{countFor(c)}</small></button>
              </Fragment>
            ))}
          </nav>
        </div>
        {sharing && <ShareMenu text={sharing.payload.body ?? sharing.payload.text ?? ""} author={sharing.author_name} url={`${siteUrl()}/app/feed?post=${sharing.id}`} onClose={() => setSharing(null)} />}
        <div className="posts ruled" id="posts" tabIndex={-1}>
          {shown.length === 0 && (
            <div className="feed-empty">
              {feed.length === 0 ? (
                <>
                  <p>Nobody has posted at {campus.name} yet. Say what you saw on the way to class.</p>
                  <button type="button" className="btn primary" onClick={() => startPost()}>Write the first post</button>
                </>
              ) : (
                <>
                  <p>{filter === "Mine" ? "Nothing for you yet." : `Nothing ${filter === "Marketplace" ? "for sale" : `for ${audience(filter)}`} yet.`} Ask where to park, or when the shuttle runs.</p>
                  <div className="feed-empty-acts">
                    <button type="button" className="btn primary" onClick={() => startPost(filter === "Mine" ? undefined : (filter as Community))}>{filter === "Mine" ? "Write a post" : `Post ${filter === "Marketplace" ? "something for sale" : `for ${audience(filter)}`}`}</button>
                    <button type="button" className="btn" onClick={() => setFilter("All")}>Show everything</button>
                  </div>
                </>
              )}
            </div>
          )}
          {shown.map(({ row: p, repostedBy }) => {
            const liked = p.post_likes.some((l) => l.user_id === me);
            const expanded = open === p.id;
            const subject = (p.payload.title ?? p.payload.body ?? p.payload.text ?? "").slice(0, 40);
            const replies = p.post_comments.length;
            const reposts = posts.filter((r) => r.payload.repostOf === p.id || r.payload.quote?.id === p.id).length; // reposts and quotes, among the posts loaded
            return (
              <article key={p.id} id={`post-${p.id}`} className="rp" tabIndex={-1} aria-description="Press l to like, r for replies, j and k to move between posts." aria-label={`Post by ${p.author_name}`}>
                <PersonLink id={p.author_id} className="rp-avlink" decorative><Avatar name={p.author_name} id={p.author_id} size={40} className="rp-av" /></PersonLink>
                <div className="rp-main">
                  {repostedBy.length > 0 && <p className="rp-reposted"><Repeat2 size={14} aria-hidden="true" />{repostLine(repostedBy)}</p>}
                  <div className="rp-head">
                    <PersonLink id={p.author_id} className="rp-name"><strong><PersonName id={p.author_id} fallback={p.author_name} /></strong></PersonLink>
                    {isVerified(p.author_id) && <span className="rp-tag">Campus staff</span>}
                    <span className="rp-time">{ago(p.created_at)}</span>
                    {p.community !== "Everyone" && <span className="rp-aud" data-aud={p.community}>{p.community === "Marketplace" ? "For sale" : `For ${audience(p.community)}`}</span>}
                    <SafetyMenu userId={p.author_id} name={p.author_name} postId={p.id} context="post" />
                  </div>
                  {p.payload.title && <h3 className="rp-title">{p.payload.title}</h3>}
                  <p className="rp-body"><RichText text={p.payload.body ?? p.payload.text ?? ""} /></p>
                  {p.payload.quote && <QuoteCard row={quotedRow(p.payload.quote.id)} />}
                  <div className="rp-acts">
                    <button type="button" aria-expanded={expanded} aria-label={`Reply${replies > 0 ? ` · ${replies}` : ""}, ${p.author_name}’s post`} onClick={() => setOpen(expanded ? null : p.id)}><MessageCircle size={16} aria-hidden="true" />Reply{replies > 0 ? ` · ${replies}` : ""}</button>
                    <button type="button" aria-pressed={liked} aria-label={`${liked ? "Liked" : "Like"}${p.post_likes.length > 0 ? ` · ${p.post_likes.length}` : ""}, ${p.author_name}’s post`} onClick={() => like(p)}><Heart size={16} aria-hidden="true" fill={liked ? "currentColor" : "none"} />{liked ? "Liked" : "Like"}{p.post_likes.length > 0 ? ` · ${p.post_likes.length}` : ""}</button>
                    <span className="rp-rep">
                      <button type="button" aria-haspopup="menu" aria-expanded={repostFor === p.id} aria-pressed={!!myRepostOf(p)} aria-label={`Repost or quote ${p.author_name}’s post${reposts > 0 ? `, ${reposts} so far` : ""}`} onClick={() => setRepostFor(repostFor === p.id ? null : p.id)}><Repeat2 size={16} aria-hidden="true" />Repost{reposts > 0 ? ` · ${reposts}` : ""}</button>
                      {repostFor === p.id && (
                        <div className="rp-menu" role="menu" aria-label="Repost or quote">
                          <button type="button" role="menuitem" autoFocus onClick={() => { setRepostFor(null); repost(p); }}><Repeat2 size={18} aria-hidden="true" />{myRepostOf(p) ? "Undo repost" : "Repost"}</button>
                          <button type="button" role="menuitem" onClick={() => { setRepostFor(null); startQuote(p); }}><Pencil size={18} aria-hidden="true" />Quote</button>
                        </div>
                      )}
                    </span>
                    <button type="button" aria-label={`Share, ${p.author_name}’s post`} onClick={() => setSharing(p)}><Send size={16} aria-hidden="true" />Share</button>
                    {p.author_id === me && <button type="button" aria-label={`Delete, your post “${subject}”`} onClick={() => remove(p)}><Trash2 size={16} aria-hidden="true" />Delete</button>}
                    <RepliedBy comments={p.post_comments} />
                    <span className="rp-keys" aria-hidden="true">j next · k back · l like · r replies</span>
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
      {!phone && <aside className="rail" id="your-list" tabIndex={-1} ref={rail} aria-label="Your campus summary">
        <div className="rail-card">
          <UpcomingList limit={4} moreTo="/app/plans" hide={["hangout"]} title="On your list" />
          <div className="cs-wide"><CampusSoon compact /></div>
        </div>
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

/** "Maya and 2 others replied", with each person's name as it is now. */
function RepliedBy({ comments }: { comments: Row["post_comments"] }) {
  const unique = comments.filter((c, i) => comments.findIndex((x) => x.user_id === c.user_id) === i).map((c) => ({ id: c.user_id, name: c.author_name }));
  const names = useLiveNames(unique).map((n) => spoken(n).split(" ")[0]);
  if (names.length === 0) return null;
  const text = names.length === 1 ? `${names[0]} replied` : names.length === 2 ? `${names[0]} and ${names[1]} replied` : `${names[0]} and ${names.length - 1} others replied`;
  return <span className="rp-who">{text}</span>;
}
