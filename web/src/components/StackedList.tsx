import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Search, Users, X } from "lucide-react";
import AvatarStack, { type StackPerson } from "./AvatarStack";
import { SweepLi, SweepUl } from "./Sweep";

type Props<T> = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  /** Faces shown on the closed bar, with "+N" for the rest. */
  people?: StackPerson[];
  items: T[];
  getKey: (item: T) => string;
  /** The words a search looks in. A search box appears once there are more than `searchAbove` items. */
  itemText?: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  empty?: ReactNode;
  searchAbove?: number;
  defaultOpen?: boolean;
  maxFaces?: number;
  /** Anything shown under the list when it is open (a button to add someone, a note). */
  footer?: ReactNode;
};

const spring = { type: "spring" as const, stiffness: 260, damping: 30, mass: 0.8 };

/**
 * A list that folds into one compact bar: an icon, a title, a count and stacked faces. Tap the bar and it opens in place into a searchable list that slides in
 * row by row; the cross folds it back. Saves the space a long list would take until someone wants it.
 */
export default function StackedList<T>({ title, subtitle, icon, people, items, getKey, itemText, renderItem, empty, searchAbove = 6, defaultOpen = false, maxFaces = 3, footer }: Props<T>) {
  const [open, setOpen] = useState(defaultOpen);
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n && itemText ? items.filter((i) => itemText(i).toLowerCase().includes(n)) : items;
  }, [items, q, itemText]);
  const toggle = () => { setOpen((v) => !v); if (open) setQ(""); };
  const key = (e: KeyboardEvent) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); toggle(); } };

  return (
    <section className="sl" data-open={open ? "" : undefined} aria-label={title}>
      <div
        className="sl-bar"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`${title}, ${subtitle ?? `${items.length}`}. ${open ? "Close" : "Open"} the list`}
        onClick={toggle}
        onKeyDown={key}
      >
        <span className="sl-ic" aria-hidden="true">{icon ?? <Users size={18} />}</span>
        <span className="sl-t"><b>{title}</b>{subtitle && <small>{subtitle}</small>}</span>
        {!open && people && people.length > 0 && <span className="sl-faces"><AvatarStack people={people.map((p) => ({ name: p.name }))} max={maxFaces} size={28} /></span>}
        {open
          ? <button type="button" className="sl-x" aria-label={`Close ${title}`} tabIndex={-1} onClick={(e) => { e.stopPropagation(); setOpen(false); setQ(""); }}><X size={16} aria-hidden="true" /></button>
          : <ChevronDown size={16} className="sl-chev" aria-hidden="true" />}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="sl-body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring}>
            {itemText && items.length > searchAbove && (
              <label className="sl-search">
                <Search size={15} aria-hidden="true" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${title.toLowerCase()}`} aria-label={`Search ${title}`} />
              </label>
            )}
            {shown.length === 0 ? (
              <p className="sl-empty muted">{q ? "Nobody matches that." : empty ?? "Nothing here yet."}</p>
            ) : (
              <SweepUl className="sl-list">
                {shown.map((item) => <SweepLi key={getKey(item)}>{renderItem(item)}</SweepLi>)}
              </SweepUl>
            )}
            {footer && <div className="sl-foot">{footer}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
