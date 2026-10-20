import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { communities, type Community } from "../shared/feed";
import { communityIcon } from "../lib/communityUi";
import { enter, exit } from "../lib/motion";

/** A themed replacement for the browser's select list. Keyboard: arrows, Enter, Escape. */
export default function CommunityPicker({ value, onChange, labelledBy }: { value: Community; onChange: (c: Community) => void; labelledBy?: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const { Icon, ink } = communityIcon[value];

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const toggle = () => { setActive(communities.indexOf(value)); setOpen((o) => !o); };
  const pick = (c: Community) => { onChange(c); setOpen(false); button.current?.focus(); };

  function key(e: KeyboardEvent) {
    if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { toggle(); return; }
      const n = communities.length;
      setActive((a) => (a + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
    } else if ((e.key === "Enter" || e.key === " ") && open) {
      e.preventDefault();
      pick(communities[active]);
    }
  }

  return (
    <div className="picker" ref={root} onKeyDown={key}>
      <button ref={button} type="button" id="community" className="picker-btn" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-labelledby={labelledBy ? `${labelledBy} community` : undefined} onClick={toggle}>
        <span className="picker-ico" style={{ color: ink }}><Icon size={16} strokeWidth={1.9} aria-hidden="true" /></span>
        {value}
        <ChevronDown size={18} className="picker-chev" aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul id={listId} role="listbox" className="picker-menu" aria-activedescendant={`${listId}-${active}`} initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1, transition: enter }} exit={{ opacity: 0, y: -4, transition: exit }}>
            {communities.map((c, i) => {
              const { Icon: I, ink: k } = communityIcon[c];
              return (
                <li key={c} id={`${listId}-${i}`} role="option" aria-selected={c === value} className={i === active ? "on" : ""} onMouseEnter={() => setActive(i)} onClick={() => pick(c)}>
                  <span className="picker-ico" style={{ color: k }}><I size={16} strokeWidth={1.9} aria-hidden="true" /></span>
                  <span>{c}</span>
                  {c === value && <Check size={16} className="picker-check" aria-hidden="true" />}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
