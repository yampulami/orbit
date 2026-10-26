import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { enter, exit } from "../lib/motion";

export type PickerOption<T extends string> = { value: T; label: string; icon?: ReactNode };

/** A themed replacement for the browser's select list. Keyboard: arrows, Enter, Escape. */
export default function Picker<T extends string>({ value, options, onChange, label, labelledBy, id, compact, narrow }: {
  value: T;
  options: PickerOption<T>[];
  onChange: (v: T) => void;
  label?: string;
  labelledBy?: string;
  id?: string;
  compact?: boolean;
  /** A short list, like hours or minutes, so the menu does not need to be wide. */
  narrow?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  // A long list (like 60 minutes) opens and moves with the chosen row in view.
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  const toggle = () => { setActive(Math.max(0, options.findIndex((o) => o.value === value))); setOpen((o) => !o); };
  const pick = (v: T) => { onChange(v); setOpen(false); button.current?.focus(); };

  function key(e: KeyboardEvent) {
    if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { toggle(); return; }
      const n = options.length;
      setActive((a) => (a + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
    } else if ((e.key === "Enter" || e.key === " ") && open) {
      e.preventDefault();
      pick(options[active].value);
    }
  }

  const btnId = id ?? `${listId}-btn`;
  return (
    <div className={"picker" + (compact ? " compact" : "") + (narrow ? " narrow" : "")} ref={root} onKeyDown={key}>
      <button ref={button} type="button" id={btnId} className="picker-btn" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        aria-label={label ? `${label}: ${current?.label}` : undefined} aria-labelledby={!label && labelledBy ? `${labelledBy} ${btnId}` : undefined} onClick={toggle}>
        {current?.icon && <span className="picker-ico">{current.icon}</span>}
        <span className="picker-label">{current?.label}</span>
        <ChevronDown size={18} className="picker-chev" aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul id={listId} role="listbox" className="picker-menu" aria-activedescendant={`${listId}-${active}`} initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1, transition: enter }} exit={{ opacity: 0, y: -4, transition: exit }}>
            {options.map((o, i) => (
              <li key={o.value} id={`${listId}-${i}`} role="option" aria-selected={o.value === value} className={i === active ? "on" : ""} onMouseEnter={() => setActive(i)} onClick={() => pick(o.value)}>
                {o.icon && <span className="picker-ico">{o.icon}</span>}
                <span>{o.label}</span>
                {o.value === value && <Check size={16} className="picker-check" aria-hidden="true" />}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
