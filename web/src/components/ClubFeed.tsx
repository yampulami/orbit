import { useState } from "react";
import { BarChart3, Check, MessageCircle, Megaphone, PenLine, Pin, PinOff, Plus, Trash2, X } from "lucide-react";
import { useClubFeed, type Post } from "../lib/clubFeed";
import type { Org } from "../lib/campusOrgs";
import EmptyState from "./EmptyState";
import GradientMenu from "./GradientMenu";
import ClubComments from "./ClubComments";
import RollingNumber from "./RollingNumber";
import RichText from "./RichText";

const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

type Mode = "post" | "announcement" | "poll";

/** A club's feed. Announcements are public (everyone on campus can read them); discussion and polls are for the club's people. What each person can
 *  post follows their role in the club. */
export default function ClubFeed({ org, reviewer, feed }: { org: Org; reviewer: boolean; feed: ReturnType<typeof useClubFeed> }) {
  const inClub = org.myJoin === "officer" || org.myJoin === "member";
  const { posts, ready, actions } = feed;
  const can = (p: string) => org.myPerms.includes(p as never);
  const modes: { key: Mode; label: string }[] = [
    ...(inClub ? [{ key: "post" as const, label: "Post" }] : []),
    ...(can("announce") ? [{ key: "announcement" as const, label: "Announcement" }] : []),
    ...(can("polls") ? [{ key: "poll" as const, label: "Poll" }] : []),
  ];
  const [mode, setMode] = useState<Mode | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [choices, setChoices] = useState(["", ""]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = mode ?? modes[0]?.key ?? null;
  const meName = org.members.find((m) => m.name === "You")?.name ?? "You";
  const titleOf = (id: string) => org.members.find((m) => m.id === id)?.title;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    setBusy(true);
    const err = active === "announcement" ? await actions.announce(title, body) : active === "poll" ? await actions.poll(title, choices) : await actions.discuss(body);
    setBusy(false);
    if (err) { setError(err); return; }
    setTitle(""); setBody(""); setChoices(["", ""]); setError("");
  }

  return (
    <section className="cf" aria-label="Club feed">
      {active && (
        <form className="cf-compose" onSubmit={submit}>
          {modes.length > 1 && (
            <GradientMenu
              className="cf-modes"
              label="What to post"
              items={modes.map((m) => ({
                key: m.key, label: m.label, on: active === m.key,
                icon: m.key === "announcement" ? Megaphone : m.key === "poll" ? BarChart3 : PenLine,
                tone: m.key === "announcement" ? ("orange" as const) : m.key === "poll" ? ("blue" as const) : ("purple" as const),
                onClick: () => { setMode(m.key); setError(""); },
              }))}
            />
          )}
          {(active === "announcement" || active === "poll") && (
            <input aria-label={active === "poll" ? "Question" : "Headline"} value={title} maxLength={120} placeholder={active === "poll" ? "Ask the club a question" : "Headline"} onChange={(e) => { setTitle(e.target.value); setError(""); }} />
          )}
          {active === "poll" ? (
            <div className="cf-choices">
              {choices.map((c, i) => <input key={i} aria-label={`Choice ${i + 1}`} value={c} maxLength={80} placeholder={`Choice ${i + 1}`} onChange={(e) => { setChoices((l) => l.map((x, j) => (j === i ? e.target.value : x))); setError(""); }} />)}
              {choices.length < 6 && <button type="button" className="link-btn" onClick={() => setChoices((l) => [...l, ""])}><Plus size={13} aria-hidden="true" /> Add a choice</button>}
            </div>
          ) : (
            <textarea aria-label={active === "announcement" ? "Details" : "Post"} rows={active === "announcement" ? 3 : 2} value={body} maxLength={2000} placeholder={active === "announcement" ? "Details (optional). Everyone on campus can read announcements." : "Share something with the club"} onChange={(e) => { setBody(e.target.value); setError(""); }} />
          )}
          {error && <p className="error" role="alert">{error}</p>}
          <div className="cf-send"><button className="btn primary" disabled={busy}>{busy ? "Posting…" : active === "announcement" ? "Announce" : active === "poll" ? "Start poll" : "Post"}</button></div>
        </form>
      )}
      {!inClub && org.status === "active" && <p className="muted cf-note">Join to see the club's discussion and polls. Announcements are open to everyone.</p>}

      {!ready ? <div className="skeleton sk-tile" aria-busy="true" /> : posts.length === 0 ? (
        <EmptyState icon={Megaphone} title="Nothing posted yet">{inClub ? "Start the conversation, or wait for an officer to share the first announcement." : "When the club posts an announcement, it shows here."}</EmptyState>
      ) : (
        <ul className="cf-list">
          {posts.map((p) => <PostCard key={p.id} p={p} title={titleOf(p.authorId)} inClub={inClub} canPin={can("announce") || can("moderate")} canModerate={can("moderate") || reviewer} actions={actions} me={meName} />)}
        </ul>
      )}
    </section>
  );
}

function PostCard({ p, title, inClub, canPin, canModerate, actions, me }: { p: Post; title?: string; inClub: boolean; me: string; canPin: boolean; canModerate: boolean; actions: ReturnType<typeof useClubFeed>["actions"] }) {
  const [open, setOpen] = useState(false);
    const [sure, setSure] = useState(false);
  const top = p.options ? Math.max(1, ...p.options.map((o) => o.votes)) : 1;
  return (
    <li className={"cf-post " + p.kind + (p.pinned ? " pinned" : "")}>
      <header>
        <i className="club-av" aria-hidden="true">{initials(p.author)}</i>
        <div className="cf-who"><strong>{p.author}</strong>{title && <span className="cf-title-chip">{title}</span>}<span className="muted">{ago(p.at)}</span></div>
        <div className="cf-tags">
          {p.pinned && <span className="ebadge wait"><Pin size={11} aria-hidden="true" /> Pinned</span>}
          {p.kind === "announcement" && <span className="ebadge official"><Megaphone size={11} aria-hidden="true" /> Announcement</span>}
          {p.kind === "poll" && <span className="ebadge student"><BarChart3 size={11} aria-hidden="true" /> Poll</span>}
        </div>
      </header>
      {p.title && <h3><RichText text={p.title} /></h3>}
      {p.body && <p className="cf-body"><RichText text={p.body} /></p>}

      {p.options && (
        <ul className="cf-poll" aria-label="Poll choices">
          {p.options.map((o) => {
            const pct = p.total ? Math.round((o.votes / p.total) * 100) : 0;
            return (
              <li key={o.id}>
                <button type="button" disabled={!inClub} aria-pressed={p.myVote === o.id} onClick={() => void actions.vote(p.id, o.id)}>
                  <span className="cf-bar" style={{ width: `${(o.votes / top) * 100}%` }} aria-hidden="true" />
                  <span className="cf-opt">{p.myVote === o.id && <Check size={14} aria-hidden="true" />}{o.label}</span>
                  <span className="cf-pct">{inClub ? `${pct}%` : ""}</span>
                </button>
              </li>
            );
          })}
          <li className="muted cf-total">{p.total ?? 0} {p.total === 1 ? "vote" : "votes"}{inClub ? "" : ". Join the club to vote."}</li>
        </ul>
      )}

      <footer>
        {p.kind !== "announcement" || inClub ? <button type="button" className="cf-act" aria-expanded={open} onClick={() => setOpen((v) => !v)}><MessageCircle size={14} aria-hidden="true" /> {p.comments.length > 0 ? <><RollingNumber value={p.comments.length} /> {p.comments.length === 1 ? "comment" : "comments"}</> : inClub ? "Comment" : "Comments"}</button> : <span />}
        <span className="cf-tools">
          {canPin && <button type="button" className="cf-act" data-on={p.pinned ? "" : undefined} onClick={() => void actions.pin(p.id, !p.pinned)}>{p.pinned ? <><PinOff size={13} aria-hidden="true" /> Unpin</> : <><Pin size={13} aria-hidden="true" /> Pin</>}</button>}
          {(p.mine || canModerate) && (sure
            ? <span className="cevent-sure"><button type="button" className="btn danger" onClick={() => void actions.remove(p.id)}>Delete</button><button type="button" className="btn" onClick={() => setSure(false)}>Keep</button></span>
            : <button type="button" className="cf-act icon" aria-label="Delete post" onClick={() => setSure(true)}><Trash2 size={13} aria-hidden="true" /></button>)}
        </span>
      </footer>

      {open && (
        <ClubComments id={p.id} comments={p.comments} canWrite={inClub} canModerate={canModerate} me={me} onPost={(body) => actions.comment(p.id, body)} onRemove={(cid) => void actions.removeComment(cid)} />
      )}
    </li>
  );
}

