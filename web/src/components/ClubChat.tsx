import { useEffect, useRef, useState } from "react";
import { Hash, Lock, MessageSquare, Plus, Send, Trash2, X } from "lucide-react";
import type { Org } from "../lib/campusOrgs";
import type { useClubChat } from "../lib/clubChat";
import EmojiButton from "./EmojiButton";
import EmptyState from "./EmptyState";
import RichText from "./RichText";

const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const dayOf = (iso: string) => {
  const d = new Date(iso), t = new Date();
  const diff = Math.round((new Date(t.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
};

/** A club's chat: channels down the side (or across the top on a phone), the conversation, and a box to write in. */
export default function ClubChat({ org, reviewer, chat }: { org: Org; reviewer: boolean; chat: ReturnType<typeof useClubChat> }) {
  const inClub = org.myJoin === "officer" || org.myJoin === "member";
  const canManage = org.owner || org.myPerms.includes("channels");
  const canModerate = org.myPerms.includes("moderate") || reviewer;
  // Team-only channels are for the team; the database hides them from everyone else, and so does the screen.
  const channels = chat.channels.filter((c) => !c.teamOnly || org.mine);
  const [activeId, setActiveId] = useState("");
  const active = channels.find((c) => c.id === activeId) ?? channels[0];
  const [text, setText] = useState("");
  const [making, setMaking] = useState(false);
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [teamOnly, setTeamOnly] = useState(false);
  const [error, setError] = useState("");
  const [sure, setSure] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const msgs = active ? chat.messagesIn(active.id) : [];

  // Keep the newest message in view, and mark the channel you are looking at as read.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
    if (active && inClub && document.visibilityState === "visible") chat.actions.markRead(active.id);
  }, [active?.id, msgs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!inClub) return <section className="cc-locked"><EmptyState icon={MessageSquare} title="The chat is for members">Join {org.name} to read and write in its channels.</EmptyState></section>;
  if (!chat.ready) return <div className="skeleton sk-tile" aria-busy="true" />;
  if (channels.length === 0) return <EmptyState icon={MessageSquare} title="No chat yet">{org.status === "active" ? "Chat opens once the club is running." : "Chat opens when a coordinator approves the club."}</EmptyState>;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!active || !text.trim()) return;
    const t = text; setText("");
    const err = await chat.actions.send(active.id, t);
    if (err) setText(t);
    input.current?.focus();
  }
  async function make(e: React.FormEvent) {
    e.preventDefault();
    const err = await chat.actions.createChannel(name, about, teamOnly);
    if (err) { setError(err); return; }
    setMaking(false); setName(""); setAbout(""); setTeamOnly(false); setError("");
  }

  let lastDay = "", lastAuthor = "", lastAt = 0;
  return (
    <section className="cc" aria-label="Club chat">
      <nav className="cc-channels" aria-label="Channels">
        {channels.map((c) => (
          <button key={c.id} type="button" className={"cc-chan" + (c.id === active?.id ? " on" : "")} aria-current={c.id === active?.id} onClick={() => { setActiveId(c.id); setSure(false); }}>
            {c.teamOnly ? <Lock size={14} aria-hidden="true" /> : <Hash size={14} aria-hidden="true" />}<span>{c.name}</span>
            {c.unread > 0 && c.id !== active?.id && <b className="cc-unread" aria-label={`${c.unread} unread`}>{c.unread > 9 ? "9+" : c.unread}</b>}
          </button>
        ))}
        {canManage && !making && <button type="button" className="cc-chan new" onClick={() => setMaking(true)}><Plus size={14} aria-hidden="true" /><span>New channel</span></button>}
      </nav>

      <div className="cc-pane">
        {making && (
          <form className="cc-new" onSubmit={make}>
            <label className="field">Channel name<input autoFocus value={name} maxLength={30} placeholder="e.g. build-night" onChange={(e) => { setName(e.target.value); setError(""); }} /></label>
            <label className="field">What is it for? (optional)<input value={about} maxLength={120} onChange={(e) => setAbout(e.target.value)} /></label>
            <label className="check-line"><input type="checkbox" checked={teamOnly} onChange={(e) => setTeamOnly(e.target.checked)} /> Team only (only the president and people with a role can see it)</label>
            {error && <p className="error" role="alert">{error}</p>}
            <div className="about-actions"><button className="btn primary" disabled={!name.trim()}>Create channel</button><button type="button" className="btn" onClick={() => { setMaking(false); setError(""); }}>Cancel</button></div>
          </form>
        )}
        {active && (
          <>
            <header className="cc-head">
              <div><h2>{active.teamOnly ? <Lock size={16} aria-hidden="true" /> : <Hash size={16} aria-hidden="true" />}{active.name}</h2>{active.description && <p className="muted">{active.description}</p>}</div>
              {canManage && !active.isDefault && (sure
                ? <span className="cevent-sure"><button type="button" className="btn danger" onClick={() => { void chat.actions.deleteChannel(active.id); setActiveId(""); setSure(false); }}>Delete channel</button><button type="button" className="btn" onClick={() => setSure(false)}>Keep</button></span>
                : <button type="button" className="link-btn" aria-label={`Delete #${active.name}`} onClick={() => setSure(true)}><Trash2 size={14} aria-hidden="true" /></button>)}
            </header>
            <div className="cc-msgs" ref={scroller} role="log" aria-live="polite" aria-label={`Messages in ${active.name}`}>
              {msgs.length === 0 && <EmptyState icon={MessageSquare} title={`Start #${active.name}`}>Say hello. Everyone in the {active.teamOnly ? "team" : "club"} can see this channel.</EmptyState>}
              {msgs.map((m) => {
                const day = dayOf(m.at);
                const at = new Date(m.at).getTime();
                const showDay = day !== lastDay;
                const joined = !showDay && m.authorId === lastAuthor && at - lastAt < 5 * 60_000;
                lastDay = day; lastAuthor = m.authorId; lastAt = at;
                const title = org.members.find((x) => x.id === m.authorId)?.title;
                return (
                  <div key={m.id} className="cc-row">
                    {showDay && <p className="cc-day"><span>{day}</span></p>}
                    <div className={"cc-msg" + (joined ? " joined" : "") + (m.mine ? " mine" : "")}>
                      {!joined && <i className="club-av sm" aria-hidden="true">{initials(m.author)}</i>}
                      <div className="cc-body">
                        {!joined && <p className="cc-meta"><strong>{m.author}</strong>{title && <span className="cf-title-chip">{title}</span>}<span className="muted">{clock(m.at)}</span></p>}
                        <p className="cc-text"><RichText text={m.body} /></p>
                      </div>
                      {(m.mine || canModerate) && <button type="button" className="link-btn cc-del" aria-label="Delete message" onClick={() => void chat.actions.deleteMessage(m.id)}><X size={13} aria-hidden="true" /></button>}
                    </div>
                  </div>
                );
              })}
            </div>
            <form className="cc-compose" onSubmit={send}>
              <input ref={input} aria-label={`Message #${active.name}`} value={text} maxLength={2000} placeholder={`Message #${active.name}`} onChange={(e) => setText(e.target.value)} />
              <EmojiButton value={text} onChange={setText} inputRef={input} max={2000} />
              <button className="btn primary" disabled={!text.trim()} aria-label="Send"><Send size={16} aria-hidden="true" /></button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
