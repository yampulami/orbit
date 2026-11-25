import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Lock, X } from "lucide-react";
import Avatar from "./Avatar";
import { OPEN_LABEL, type Alum, type OpenTo } from "../lib/alumni";

/** A first line for each kind of help, so nobody faces a blank box. The student finishes the thought in their own words. */
const STARTERS: Record<OpenTo | "hello", { label: string; text: (a: Alum) => string }> = {
  referrals: { label: "A referral", text: (a) => `I am applying to ${a.company || "your company"} and wondered if you could refer me. A bit about me: ` },
  mentoring: { label: "Advice", text: (a) => `I would value your advice on getting into ${a.industry || "your field"}. What I am working on: ` },
  chats: { label: "A coffee chat", text: () => "Would you have 20 minutes for a quick chat about your path? I am curious about " },
  hiring: { label: "Open roles", text: (a) => `Is your team at ${a.company || "your company"} looking for anyone? What I can do: ` },
  hello: { label: "Just a hello", text: () => "I saw your listing and wanted to say hello. " },
};

export default function AlumniAsk({ person, shared, onSend, onClose }: { person: Alum; shared: string[]; onSend: (note: string) => Promise<string | null>; onClose: () => void }) {
  const [note, setNote] = useState(shared.length ? `We are both from ${shared[0]}. ` : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const box = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    area.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !box.current) return;
      const all = [...box.current.querySelectorAll<HTMLElement>("button:not([disabled]),textarea")];
      const first = all[0], last = all[all.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); before?.focus(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = (k: keyof typeof STARTERS) => {
    const line = (shared.length ? `We are both from ${shared[0]}. ` : "") + STARTERS[k].text(person);
    setNote(line.slice(0, 300));
    area.current?.focus();
  };
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) { setError("Write a line about what you are asking for."); return; }
    setBusy(true); setError("");
    const p = await onSend(note);
    setBusy(false);
    if (p) setError(p);
  }
  const choices: (keyof typeof STARTERS)[] = person.openTo.length ? [...person.openTo, "hello"] : ["chats", "hello"];

  return createPortal(
    <div className="sheet-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form ref={box} className="sheet al-sheet" role="dialog" aria-modal="true" aria-labelledby="al-sheet-title" onSubmit={send}>
        <button type="button" className="sheet-x" aria-label="Close" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        <div className="al-sheet-who">
          <Avatar name={person.name} id={person.id} size={48} />
          <div>
            <h2 id="al-sheet-title">Ask {person.name} for an introduction</h2>
            <p className="muted">{[person.jobTitle, person.company].filter(Boolean).join(" at ") || `Class of ${person.gradYear}`}</p>
          </div>
        </div>
        <div className="al-starters" role="group" aria-label="Start with">
          {choices.map((k) => <button key={k} type="button" className="chip-btn" onClick={() => start(k)}>{k === "hello" ? STARTERS.hello.label : STARTERS[k].label}</button>)}
        </div>
        {person.openTo.length > 0 && <p className="muted al-sheet-open">They are open to {person.openTo.map((o) => OPEN_LABEL[o].toLowerCase()).join(", ")}.</p>}
        <label className="al-sheet-field">Your note
          <textarea ref={area} rows={5} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Say who you are and what you are asking for." />
          <span className="al-count" aria-hidden="true">{note.length}/300</span>
        </label>
        <p className="al-private"><Lock size={14} aria-hidden="true" /> They see your name, profile and this note. Not your email. A chat opens only if they accept.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="al-actions"><button className="btn sm primary" disabled={busy}>{busy ? "Sending…" : "Send request"}</button><button type="button" className="btn sm" onClick={onClose}>Not now</button></div>
      </form>
    </div>,
    document.body,
  );
}
