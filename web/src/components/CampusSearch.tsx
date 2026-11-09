import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { Check, GraduationCap, Search } from "lucide-react";
import { loadUniversities, placeOf, preferredCountry, searchUniversities, type University } from "../lib/universities";

/** Type a university and pick it from suggestions that appear from the first letter. If it is not on the list, the typed name can be used as it is. */
export default function CampusSearch({ value, onPick, autoFocus }: { value: University | null; onPick: (u: University | null) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<University[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);

  // Fetch the list the first time the field is used.
  const [retrying, setRetrying] = useState(false);
  const warm = () => { if (!list && !failed) loadUniversities().then(setList).catch(() => setFailed(true)); };
  // After a failure, try the download again when asked.
  const retry = () => { setRetrying(true); loadUniversities().then((l) => { setList(l); setFailed(false); }).catch(() => setFailed(true)).finally(() => setRetrying(false)); };
  useEffect(() => { if (autoFocus) warm(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const results = useMemo(() => (list ? searchUniversities(list, q, 8, preferredCountry()) : []), [list, q]);
  const typed = q.trim();
  // A typed name is only offered once the list has loaded and nothing on it matches. Offering it next to real matches, or without the list, would let a
  // half-typed name ("caldwell") become its own campus, separate from "Caldwell University".
  const canUseTyped = !!list && typed.length >= 2 && results.length === 0;
  const total = results.length + (canUseTyped ? 1 : 0);

  function choose(i: number) {
    const u = i < results.length ? results[i] : { name: typed, country: "", region: "", domain: "" };
    onPick(u);
    setQ("");
    setOpen(false);
  }

  function onKeys(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => (total ? (a + 1) % total : 0)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (total ? (a - 1 + total) % total : 0)); }
    else if (e.key === "Enter" && open && total > 0) { e.preventDefault(); choose(Math.min(active, total - 1)); }
    else if (e.key === "Escape") setOpen(false);
  }

  if (value) {
    return (
      <motion.div className="campus-chosen" role="status" initial={{ scale: 0.9, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 520, damping: 26 }}>
        <span className="campus-ico" aria-hidden="true"><GraduationCap size={18} /></span>
        <span className="campus-name"><strong>{value.name}</strong>{(placeOf(value) || value.domain) && <em>{[placeOf(value), value.domain].filter(Boolean).join(" · ")}</em>}</span>
        <button type="button" className="campus-change" onClick={() => onPick(null)}>Change</button>
      </motion.div>
    );
  }

  return (
    <div className="campus-search" ref={root}>
      <label className="map-search">
        <Search size={16} aria-hidden="true" />
        <span className="sr">Your university</span>
        <input
          role="combobox" aria-expanded={open && total > 0} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={open && total > 0 ? `${listId}-${active}` : undefined}
          autoFocus={autoFocus} autoComplete="off" spellCheck={false} placeholder="Start typing your university"
          value={q} onFocus={() => { warm(); setOpen(true); }} onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); warm(); }} onKeyDown={onKeys}
        />
      </label>
      {open && typed && (
        <ul className="campus-list" id={listId} role="listbox" aria-label="Universities">
          {!list && !failed && <li className="campus-note" role="presentation">Loading universities…</li>}
          {failed && (
            <li className="campus-note campus-fail" role="presentation">
              <span>We could not load the list of universities. Check your connection, then try again.</span>
              <button type="button" className="btn sm" disabled={retrying} onMouseDown={(e) => { e.preventDefault(); retry(); }}>{retrying ? "Trying…" : "Try again"}</button>
            </li>
          )}
          {results.map((u, i) => (
            <motion.li key={`${u.name}-${u.country}-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.035, duration: 0.2 } }} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={i === active ? "on" : ""} onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); choose(i); }}>
              <span className="campus-ico" aria-hidden="true"><GraduationCap size={16} /></span>
              <span><strong>{u.name}</strong>{(placeOf(u) || u.domain) && <em>{[placeOf(u), u.domain].filter(Boolean).join(" · ")}</em>}</span>
              {i === active && <Check size={15} aria-hidden="true" />}
            </motion.li>
          ))}
          {canUseTyped && (
            <li id={`${listId}-${results.length}`} role="option" aria-selected={active === results.length} className={"custom" + (active === results.length ? " on" : "")} onMouseEnter={() => setActive(results.length)} onMouseDown={(e) => { e.preventDefault(); choose(results.length); }}>
              <span><strong>Use "{typed}"</strong><em>Not on the list? Add it exactly as its official name.</em></span>
            </li>
          )}
          {list && results.length === 0 && !canUseTyped && <li className="campus-note" role="presentation">Keep typing the name of your university.</li>}
        </ul>
      )}
    </div>
  );
}
