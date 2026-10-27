import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Keyboard, X } from "lucide-react";
import { GO, isTyping, shortcut } from "../lib/shortcuts";
import { enter, exit } from "../lib/motion";

/** Listens for keyboard shortcuts and shows the list when "?" is pressed. Does nothing while you are typing in a box or holding Ctrl, Alt or Cmd. */
export default function Shortcuts({ onNew }: { onNew: () => void }) {
  const nav = useNavigate();
  const [help, setHelp] = useState(false);
  const afterG = useRef(0);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") { setHelp(false); return; }
      if (isTyping(document.activeElement)) return;
      const r = shortcut(e.key, Date.now() - afterG.current < 1200);
      afterG.current = r?.kind === "wait" ? Date.now() : 0;
      if (!r) return;
      if (r.kind === "go") { e.preventDefault(); nav(r.to); }
      else if (r.kind === "new") { e.preventDefault(); onNew(); }
      else if (r.kind === "search") { e.preventDefault(); document.querySelector<HTMLInputElement>(".gsearch input")?.focus(); }
      else if (r.kind === "help") { e.preventDefault(); setHelp((v) => !v); }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [nav, onNew]);

  return (
    <AnimatePresence>
      {help && (
        <motion.div className="modal-back" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setHelp(false); }} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: enter }} exit={{ opacity: 0, transition: exit }}>
          <motion.div className="shortcuts" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1, transition: enter }} exit={{ opacity: 0, y: 6, transition: exit }}>
            <header><h2><Keyboard size={18} aria-hidden="true" /> Keyboard shortcuts</h2><button type="button" className="ghost-btn" aria-label="Close" onClick={() => setHelp(false)}><X size={16} aria-hidden="true" /></button></header>
            <dl>
              {Object.entries(GO).map(([k, v]) => <div key={k}><dt><kbd>g</kbd> <kbd>{k}</kbd></dt><dd>Go to {v.label}</dd></div>)}
              <div><dt><kbd>n</kbd></dt><dd>New post</dd></div>
              <div><dt><kbd>/</kbd> or <kbd>Ctrl</kbd> <kbd>K</kbd></dt><dd>Search</dd></div>
              <div><dt><kbd>?</kbd></dt><dd>This list</dd></div>
            </dl>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
