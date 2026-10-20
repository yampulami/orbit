import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { enter, slide } from "../lib/motion";

type Msg = { mine: boolean; text: string };
const seedThreads: Record<string, Msg[]> = {
  Maya: [{ mine: false, text: "Are you coming to the club fair tomorrow?" }],
  Jordan: [{ mine: false, text: "Still good for carpooling Thursday?" }, { mine: true, text: "Yes, 8:30 at the north lot." }],
  "Hamilton Hall 3F": [{ mine: false, text: "Pizza in the lounge at 7!" }],
};

/** Demo-only conversations, stored in memory. The real version will use your DM tables. */
export default function Messages() {
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
              return <motion.p key={`${active}-${i}`} className={"bubble" + (m.mine ? " mine" : "")} initial={isNew ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} transition={enter}>{m.text}</motion.p>;
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
