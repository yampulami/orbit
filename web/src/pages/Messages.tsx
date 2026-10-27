import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageCircle, Plus, Send } from "lucide-react";
import EmptyState from "../components/EmptyState";
import EmojiButton from "../components/EmojiButton";
import RichText from "../components/RichText";
import { enter, slide } from "../lib/motion";
import { dmActions, dmLive, useDms } from "../lib/dms";
import SafetyMenu from "../components/SafetyMenu";
import { onTyping, sendTyping } from "../lib/nudge";
import { useAuth } from "../lib/auth";

type Msg = { mine: boolean; text: string };
const seedThreads: Record<string, Msg[]> = {
  Maya: [{ mine: false, text: "Are you coming to the club fair tomorrow?" }],
  Jordan: [{ mine: false, text: "Still good for carpooling Thursday?" }, { mine: true, text: "Yes, 8:30 at the north lot." }],
  "Hamilton Hall 3F": [{ mine: false, text: "Pizza in the lounge at 7!" }],
};

export default function Messages() {
  return dmLive ? <LiveMessages /> : <SampleMessages />;
}

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Direct messages with students on your campus. New messages show up on their own, without refreshing. */
function LiveMessages() {
  const { threads, people, status } = useDms();
  const [active, setActive] = useState<string>("");
  const [text, setText] = useState("");
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const dmInput = useRef<HTMLInputElement>(null);
  const { session } = useAuth();
  const [typingAt, setTypingAt] = useState(0);
  const [, tick] = useState(0);
  // Arriving from someone's profile ("Message") opens that conversation.
  const asked = (useLocation().state as { thread?: string } | null)?.thread;
  useEffect(() => { if (asked) { setActive(asked); setPicking(false); } }, [asked]);
  const current = threads.find((t) => t.id === active) ?? (picking ? undefined : threads[0]);
  const shownId = current?.id ?? "";

  // Keep the newest message in view, and mark what you are looking at as read.
  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; }, [shownId, current?.messages.length]);
  useEffect(() => { if (current && current.unread > 0 && document.visibilityState === "visible") dmActions.markRead(current.id); }, [current?.id, current?.unread]);

  // "typing…" while the other person is typing in this chat (a quiet note that fades after a few seconds).
  useEffect(() => {
    setTypingAt(0);
    if (!current) return;
    return onTyping(current.id, (uid) => { if (uid === current.otherId) setTypingAt(Date.now()); });
  }, [current?.id, current?.otherId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!typingAt) return;
    const t = setTimeout(() => tick((n) => n + 1), 4200);
    return () => clearTimeout(t);
  }, [typingAt]);
  const typing = typingAt > 0 && Date.now() - typingAt < 4000;
  // A new message ends the "typing" note, and keeps the newest thing in view.
  useEffect(() => { setTypingAt(0); }, [current?.messages.length]);
  useEffect(() => { const el = scroller.current; if (el && typing) el.scrollTop = el.scrollHeight; }, [typing]);
  const lastMine = current ? [...current.messages].reverse().find((m) => m.mine) : undefined;

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return people.filter((p) => !needle || p.name.toLowerCase().includes(needle)).slice(0, 40);
  }, [people, q]);

  function send(e: FormEvent) {
    e.preventDefault();
    if (!current || !text.trim()) return;
    dmActions.send(current.id, text);
    setText("");
  }

  async function startWith(id: string) {
    const made = await dmActions.start(id);
    if (made) { setActive(made); setPicking(false); setQ(""); }
  }

  return (
    <div className="page">
      <h1 className="sr">Messages</h1>
      <div className="chat">
        <div className="threads" role="tablist" aria-label="Conversations">
          <button type="button" className="thread new" onClick={() => { setPicking((v) => !v); setActive(""); }} aria-expanded={picking}><Plus size={16} aria-hidden="true" /><strong>New message</strong></button>
          {threads.map((t) => (
            <button key={t.id} role="tab" aria-selected={!picking && t.id === shownId} className={"thread" + (!picking && t.id === shownId ? " on" : "")} onClick={() => { setPicking(false); setActive(t.id); }}>
              {!picking && t.id === shownId && <motion.span layoutId="thread-indicator" className="threadpill" transition={slide} />}
              <strong>{t.name}{t.unread > 0 && <span className="dm-unread" aria-label={`${t.unread} unread`}>{t.unread}</span>}</strong>
              <span className="muted">{t.messages.length ? t.messages[t.messages.length - 1].text : "No messages yet"}</span>
            </button>
          ))}
        </div>

        <div className="convo card">
          {picking ? (
            <div className="dm-pick">
              <div className="convo-head"><div><h2>New message</h2><p className="muted">Pick someone from your campus.</p></div></div>
              <label className="field"><span className="sr">Search people</span><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" /></label>
              {matches.length === 0 ? <p className="rm-empty">{people.length === 0 ? "Nobody else from your campus has joined yet." : "No one matches that."}</p> : (
                <ul className="dm-people">
                  {matches.map((p) => <li key={p.id}><button type="button" className="thread" onClick={() => void startWith(p.id)}><strong>{p.name}</strong></button></li>)}
                </ul>
              )}
            </div>
          ) : current ? (
            <>
              <div className="convo-head"><div><h2><Link to={`/app/people/${current.otherId}`} className="person-link">{current.name}</Link></h2><p className="muted">Direct message</p></div><SafetyMenu userId={current.otherId} name={current.name} context="direct message" /></div>
              <div className="bubbles" ref={scroller} aria-live="polite">
                {current.messages.length === 0 && <p className="rm-empty">Say hello to {current.name}.</p>}
                {current.messages.map((m) => (
                  <motion.div key={m.id} className={"bubble-row" + (m.mine ? " mine" : "")} initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={enter}>
                    <p className={"bubble" + (m.mine ? " mine" : "")} title={time(m.at)}><RichText text={m.text} /></p>
                    {m === lastMine && <span className="bubble-meta">{m.seenAt ? `Seen ${time(m.seenAt)}` : time(m.at)}</span>}
                  </motion.div>
                ))}
                {typing && <div className="bubble-row" aria-live="polite"><p className="bubble typing" aria-label={`${current.name} is typing`}><i /><i /><i /></p></div>}
              </div>
              <form className="comment-form" onSubmit={send}>
                <input ref={dmInput} aria-label="Message" value={text} onChange={(e) => { setText(e.target.value); if (e.target.value && session) sendTyping(current.id, session.user.id); }} maxLength={2000} placeholder={`Message ${current.name}…`} />
                <EmojiButton value={text} onChange={setText} inputRef={dmInput} max={2000} />
                <button className="btn primary" aria-label="Send" disabled={!text.trim()}><Send size={16} /></button>
              </form>
            </>
          ) : (
            status === "loading" ? (
              <div className="dm-empty" aria-busy="true" aria-label="Loading your messages"><div className="skeleton sk-line" /><div className="skeleton sk-line short" /><div className="skeleton sk-tile" /></div>
            ) : (
              <EmptyState icon={MessageCircle} title={status === "error" ? "Messages did not load" : "No messages yet"}
                action={status === "ready" ? <button type="button" className="btn primary" onClick={() => setPicking(true)}><Plus size={16} aria-hidden="true" />New message</button> : undefined}>
                {status === "error" ? "Check your connection and reopen this page." : "Start a conversation with someone on your campus."}
              </EmptyState>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/** Demo-only conversations, stored in memory, for when there is no database. */
function SampleMessages() {
  const [threads, setThreads] = useState(seedThreads);
  const [active, setActive] = useState("Maya");
  const [text, setText] = useState("");
  const [fresh, setFresh] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; }, [active, threads[active].length]);

  function send(e: FormEvent) {
    e.preventDefault();
    const t = text.trim(); if (!t) return;
    setThreads((s) => ({ ...s, [active]: [...s[active], { mine: true, text: t }] }));
    setFresh(`${active}-${threads[active].length}`);
    setText("");
  }

  return (
    <div className="page">
      <h1 className="sr">Messages</h1>
      <div className="chat">
        <div className="threads" role="tablist" aria-label="Conversations">
          {Object.keys(threads).map((n) => (
            <button key={n} role="tab" aria-selected={n === active} className={"thread" + (n === active ? " on" : "")} onClick={() => setActive(n)}>
              {n === active && <motion.span layoutId="thread-indicator" className="threadpill" transition={slide} />}
              <strong>{n}</strong>
              <span className="muted">{threads[n][threads[n].length - 1].text}</span>
            </button>
          ))}
        </div>
        <div className="convo card">
          <div className="convo-head"><div><h2>{active}</h2><p className="muted">Sample conversation</p></div></div>
          <div className="bubbles" ref={scroller}>
            {threads[active].map((m, i) => {
              const isNew = fresh === `${active}-${i}`;
              return <motion.p key={`${active}-${i}`} className={"bubble" + (m.mine ? " mine" : "")} initial={isNew ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} transition={enter}><RichText text={m.text} /></motion.p>;
            })}
          </div>
          <form className="comment-form" onSubmit={send}>
            <input aria-label="Message" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${active}…`} />
            <button className="btn primary" aria-label="Send" disabled={!text.trim()}><Send size={16} /></button>
          </form>
        </div>
      </div>
    </div>
  );
}
