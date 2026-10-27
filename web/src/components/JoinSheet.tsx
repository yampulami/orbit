import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import Orb from "./Orb";

const STARTERS = ["I am new to this", "I have done this before", "I want to meet people"];

/** The "ask to join" window: a short, friendly note to the club's officers. A sheet from the bottom on a phone, a small window on a computer. */
export default function JoinSheet({ open, name, onSend, onClose }: { open: boolean; name: string; onSend: (note: string) => Promise<void>; onClose: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setNote("");
    const lock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = lock; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await onSend(note);
    setBusy(false);
  }
  const add = (s: string) => { setNote((n) => (n.trim() ? `${n.trim()} ${s}.` : `${s}.`).slice(0, 200)); area.current?.focus(); };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="sheet-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <motion.form className="sheet" role="dialog" aria-modal="true" aria-label={`Ask to join ${name}`} onSubmit={send}
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 36 }}
            onAnimationComplete={() => area.current?.focus()}>
            <button type="button" className="sheet-x" aria-label="Close" onClick={onClose}><X size={18} aria-hidden="true" /></button>
            <Orb size={56} variant="violet" mood={busy ? "loading" : "happy"} />
            <h2>Ask to join {name}</h2>
            <p className="muted">An officer will read this and let you in. You will get a notification either way.</p>
            <div className="sheet-starters" role="group" aria-label="Quick starters">
              {STARTERS.map((s) => <button key={s} type="button" className="chip-btn" onClick={() => add(s)}>{s}</button>)}
            </div>
            <div className="sheet-field">
              <textarea ref={area} aria-label="A line for the officers (optional)" rows={3} maxLength={200} value={note} placeholder="Say hi. Why do you want to join? (optional)" onChange={(e) => setNote(e.target.value)} />
              <span className="count">{note.length}/200</span>
            </div>
            <div className="sheet-actions"><button type="button" className="link-btn" onClick={onClose}>Not now</button><button className="btn sm primary" disabled={busy}>{busy ? "Sending…" : "Send request"}</button></div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
