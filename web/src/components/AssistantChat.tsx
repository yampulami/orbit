import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUp, Menu, Plus, Trash2, X } from "lucide-react";
import { groupChats, NEW_TITLE, type Chat, type Msg } from "../lib/assistantChats";
import Orb from "./Orb";
import { ThinkingOrb, type OrbState } from "thinking-orbs";

/** Which animation says what the assistant is doing: looking things up, getting something ready, or just thinking. */
const orbFor = (step?: string): OrbState => (!step ? "working" : /event|club|people|feed|notification|inbox/i.test(step) ? "searching" : /schedule|reminder|group/i.test(step) ? "listening" : "solving");

const SUGGESTIONS = ["What's on tonight?", "When is my next class?", "Which clubs am I in?", "Any unread messages?"];

/** Words appear one after another, so a fresh answer is written out rather than dropped in. */
function Reveal({ text, live, onGrow }: { text: string; live: boolean; onGrow: () => void }) {
  const parts = useMemo(() => text.split(/(\s+)/), [text]);
  const [n, setN] = useState(live ? 0 : parts.length);
  useEffect(() => {
    if (!live) { setN(parts.length); return; }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(parts.length); return; }
    const t = window.setInterval(() => setN((v) => { if (v + 3 >= parts.length) { window.clearInterval(t); return parts.length; } return v + 3; }), 34);
    return () => window.clearInterval(t);
  }, [live, parts.length]);
  useEffect(() => { onGrow(); }, [n]); // eslint-disable-line react-hooks/exhaustive-deps
  return <>{bold(parts.slice(0, n).join(""))}</>;
}

/** The model writes **bold** the way chat apps do; show it as bold rather than as asterisks. */
function bold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((t, i) => (t.startsWith("**") && t.endsWith("**") && t.length > 4 ? <strong key={i}>{t.slice(2, -2)}</strong> : t.replace(/\*\*/g, "")));
}

type Props = {
  chats: Chat[];
  activeId: string | null;
  /** The answer being written out right now. */
  freshId: string | null;
  thinking: boolean;
  /** What the assistant is doing while it works ("Checking events"). */
  step?: string;
  /** The student answered a confirm card. */
  onDecide: (messageId: string, yes: boolean) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onSend: (text: string) => void;
  onGo: (path: string) => void;
  onClose: () => void;
};

/** A ChatGPT-style dialog for the Orbit assistant: history on the left, the conversation on the right, a composer at the bottom. */
export default function AssistantChat({ chats, activeId, freshId, thinking, step, onDecide, onSelect, onNew, onDelete, onClear, onSend, onGo, onClose }: Props) {
  const [draft, setDraft] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const active = chats.find((c) => c.id === activeId) ?? null;
  const messages: Msg[] = active?.messages ?? [];
  const groups = useMemo(() => groupChats(chats), [chats]);

  const toEnd = () => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; };
  useLayoutEffect(toEnd, [messages.length, thinking, activeId]);
  useEffect(() => { field.current?.focus({ preventScroll: true }); }, [activeId]);
  useEffect(() => { setConfirmClear(false); }, [chats.length]);
  // The composer grows with what is typed, up to a few lines.
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 132) + "px";
  }, [draft]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (drawer) setDrawer(false); else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer, onClose]);

  const send = (text = draft) => {
    const t = text.trim();
    if (!t || thinking) return;
    setDraft("");
    onSend(t);
  };
  const pick = (id: string) => { onSelect(id); setDrawer(false); };

  return (
    <div className="ac-shell" data-drawer={drawer ? "" : undefined}>
      <aside className="ac-side" aria-label="Chat history">
        <div className="ac-brand">
          <span className="ac-logo" aria-hidden="true"><Orb size={30} variant="violet" poke={false} /></span>
          <span className="ac-brand-t"><b>Orbit assistant</b><small>Ask anything, plan anything</small></span>
        </div>
        <button type="button" className="ac-new" onClick={() => { onNew(); setDrawer(false); }}>
          <Plus size={16} aria-hidden="true" /> New chat
        </button>
        <nav className="ac-hist" aria-label="Past chats">
          {groups.length === 0 && <p className="ac-hist-empty">Your chats show up here.</p>}
          {groups.map((g) => (
            <section key={g.label}>
              <h3>{g.label}</h3>
              <ul>
                {g.chats.filter((c) => c.messages.length > 0 || c.id === activeId).map((c) => (
                  <li key={c.id} data-active={c.id === activeId ? "" : undefined}>
                    <button type="button" className="ac-item" aria-current={c.id === activeId ? "true" : undefined} onClick={() => pick(c.id)}>{c.title}</button>
                    <button type="button" className="ac-del" aria-label={`Delete chat: ${c.title}`} onClick={() => onDelete(c.id)}><Trash2 size={14} aria-hidden="true" /></button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
        <div className="ac-side-foot">
          <span>Kept on this device only.</span>
          {chats.length > 0 && (confirmClear
            ? <button type="button" className="link-btn" onClick={onClear}>Yes, clear all</button>
            : <button type="button" className="link-btn" onClick={() => setConfirmClear(true)}>Clear history</button>)}
        </div>
      </aside>
      <button type="button" className="ac-scrim" aria-label="Close history" tabIndex={-1} onClick={() => setDrawer(false)} />

      <section className="ac-main" aria-label="Conversation">
        <header className="ac-head">
          <button type="button" className="ac-icon ac-menu" aria-label="Show chat history" onClick={() => setDrawer(true)}><Menu size={18} aria-hidden="true" /></button>
          <span className="ac-head-t">{active && active.title !== NEW_TITLE ? active.title : "Orbit assistant"}</span>
          <button type="button" className="ac-icon" aria-label="New chat" title="New chat" onClick={onNew}><Plus size={18} aria-hidden="true" /></button>
          <button type="button" className="ac-icon" aria-label="Close the assistant" title="Close" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </header>

        <div className="ac-scroll" ref={scroller}>
          {messages.length === 0 ? (
            <div className="ac-empty">
              <ThinkingOrb state="breathing" size={64} />
              <h2>How can I help?</h2>
              <p>Ask about tonight, a club, your classes or your reminders. I can also take you to a page.</p>
              <div className="ac-chips">
                {SUGGESTIONS.map((s) => <button key={s} type="button" className="chip-btn" onClick={() => send(s)}>{s}</button>)}
              </div>
            </div>
          ) : (
            <ol className="ac-msgs" aria-live="polite">
              {messages.map((m) => (
                <li key={m.id} className={"ac-msg " + m.role}>
                  {m.role === "assistant" && <span className="ac-av" aria-hidden="true" />}
                  <div className="ac-body">
                    <p className="ac-text">{m.role === "assistant" ? <Reveal text={m.text} live={m.id === freshId} onGrow={toEnd} /> : m.text}</p>
                    {m.role === "assistant" && m.pending && (
                      <div className="ac-confirm" data-state={m.pending.state}>
                        <p>{m.pending.summary}</p>
                        {m.pending.state === "pending" ? (
                          <div className="ac-confirm-row"><button type="button" className="btn sm primary" onClick={() => onDecide(m.id, true)}>Confirm</button><button type="button" className="btn sm" onClick={() => onDecide(m.id, false)}>Cancel</button></div>
                        ) : (
                          <span className="ac-confirm-state">{m.pending.state === "done" ? "✓ " : m.pending.state === "cancelled" ? "Cancelled" : "Could not do that. "}{m.pending.note ?? ""}</span>
                        )}
                      </div>
                    )}
                    {m.role === "assistant" && m.go && (
                      <button type="button" className="btn sm ac-go" onClick={() => onGo(m.go!)}>{m.goLabel ?? "Open"} <ArrowRight size={14} aria-hidden="true" /></button>
                    )}
                  </div>
                </li>
              ))}
              {thinking && (
                <li className="ac-msg assistant" aria-label="Orbit is thinking">
                  <div className="ac-body"><p className="ac-text ac-think"><ThinkingOrb state={orbFor(step)} size={64} />{step && <span className="ac-step">{step}</span>}</p></div>
                </li>
              )}
            </ol>
          )}
        </div>

        <form className="ac-composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <textarea
            ref={field}
            rows={1}
            value={draft}
            maxLength={300}
            placeholder="Ask Orbit anything"
            aria-label="Message Orbit"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
          />
          <button type="submit" className="ac-send" aria-label="Send" data-ready={draft.trim() && !thinking ? "" : undefined} disabled={!draft.trim() || thinking}><ArrowUp size={18} aria-hidden="true" /></button>
        </form>
      </section>
    </div>
  );
}
