import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

export type DropOption<T extends string | number> = { value: T; label: string; hint?: string };

/** A choice list in Orbit's own style, in place of the browser's. Opens under the button, closes when you pick, press outside, or press Escape. Arrow keys move, Enter picks. */
export default function Dropdown<T extends string | number>({ options, value, onChange, label, className = "" }: { options: DropOption<T>[]; value: T; onChange: (v: T) => void; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const out = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", out);
    return () => document.removeEventListener("pointerdown", out);
  }, [open]);

  const show = () => { setActive(Math.max(0, options.findIndex((o) => o.value === value))); setOpen(true); };
  const pick = (v: T) => { onChange(v); setOpen(false); };

  return (
    <div className={"dd " + className} ref={box}>
      <button
        type="button"
        className="dd-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current?.label ?? ""}`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          else if (e.key === "ArrowDown") { e.preventDefault(); if (!open) show(); else setActive((a) => Math.min(options.length - 1, a + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); if (!open) show(); else setActive((a) => Math.max(0, a - 1)); }
          else if ((e.key === "Enter" || e.key === " ") && open) { e.preventDefault(); pick(options[active].value); }
        }}
      >
        <span className="dd-val">{current?.label ?? "Choose"}</span>
        <ChevronDown size={15} className="dd-chev" aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            className="dd-list"
            role="listbox"
            aria-label={label}
            id={id}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
          >
            {options.map((o, i) => (
              <li key={String(o.value)} role="option" aria-selected={o.value === value} data-active={i === active ? "" : undefined} onMouseEnter={() => setActive(i)} onClick={() => pick(o.value)}>
                <span>{o.label}{o.hint && <small>{o.hint}</small>}</span>
                {o.value === value && <Check size={14} aria-hidden="true" />}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
