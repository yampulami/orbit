import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";

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

  function send(e: FormEvent) {
    e.preventDefault();
    const t = text.trim(); if (!t) return;
    setThreads((s) => ({ ...s, [active]: [...s[active], { mine: true, text: t }] }));
    setText("");
  }

  return (
    <>
      <h1>Messages</h1>
      <p className="notice" style={{ marginBottom: 14 }}>Demo mode: conversations are local to this page.</p>
      <div className="chat">
        <div className="threads" role="tablist" aria-label="Conversations">
          {Object.keys(threads).map((n) => (
            <button key={n} role="tab" aria-selected={n === active} className={"thread" + (n === active ? " on" : "")} onClick={() => setActive(n)}>
              <strong>{n}</strong>
              <span className="muted">{threads[n][threads[n].length - 1].text}</span>
            </button>
          ))}
        </div>
        <div className="convo card">
          <div className="bubbles">
            {threads[active].map((m, i) => <p key={i} className={"bubble" + (m.mine ? " mine" : "")}>{m.text}</p>)}
          </div>
          <form className="comment-form" onSubmit={send}>
            <input aria-label="Message" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${active}…`} />
            <button className="btn primary" aria-label="Send" disabled={!text.trim()}><Send size={16} /></button>
          </form>
        </div>
      </div>
    </>
  );
}
