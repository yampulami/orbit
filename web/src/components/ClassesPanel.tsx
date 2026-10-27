import { useState, type FormEvent } from "react";
import { GraduationCap, MapPin, Plus, Trash2 } from "lucide-react";
import { DAY_LETTERS, DAY_NAMES, WEEK_ORDER, classActions, clockLabel, useClasses } from "../lib/classes";
import { undo } from "../lib/undo";
import { notice } from "../lib/notice";
import TimePicker from "./TimePicker";
import EmptyState from "./EmptyState";

/** The weekly class schedule: what is there, and a quick way to add a class. It appears on the week board and in "Coming up". */
export default function ClassesPanel() {
  const classes = useClasses();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [days, setDays] = useState<number[]>([1, 3]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:15");
  const [error, setError] = useState("");

  function add(e: FormEvent) {
    e.preventDefault();
    const bad = classActions.add({ name, place, days, start, end });
    if (bad) { setError(bad); return; }
    notice.show({ icon: "calendar", title: `${name.trim()} is on your schedule`, message: "It shows on the week board and in Coming up.", ms: 3500 });
    setName(""); setPlace(""); setError(""); setOpen(false);
  }
  function remove(id: string, label: string) {
    const gone = classActions.remove(id);
    if (gone) undo.show(`${label} removed`, { onUndo: () => classActions.restore(gone.item, gone.index), commit: () => {} });
  }
  const toggle = (d: number) => { setDays((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d])); setError(""); };

  return (
    <section className="classes" aria-label="Class schedule">
      <header>
        <h3><GraduationCap size={15} aria-hidden="true" />Class schedule</h3>
        <button type="button" className="btn" aria-expanded={open} onClick={() => { setOpen((v) => !v); setError(""); }}><Plus size={16} aria-hidden="true" />Add a class</button>
      </header>

      {open && (
        <form className="class-form" onSubmit={add}>
          <label className="field">Class<input autoFocus value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="e.g. Calculus II" maxLength={60} /></label>
          <label className="field">Where (optional)<input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="e.g. Smith Hall 204" maxLength={60} /></label>
          <div role="group" aria-label="Days it meets" className="class-days">
            {WEEK_ORDER.map((d) => <button key={d} type="button" aria-pressed={days.includes(d)} aria-label={DAY_NAMES[d]} onClick={() => toggle(d)}>{DAY_LETTERS[d]}</button>)}
          </div>
          <div className="class-times"><span>Starts</span><TimePicker value={start} onChange={setStart} /></div>
          <div className="class-times"><span>Ends</span><TimePicker value={end} onChange={setEnd} /></div>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn primary">Add to my schedule</button>
        </form>
      )}

      {classes.length === 0 && !open ? (
        <EmptyState icon={GraduationCap} title="No classes yet">Add your classes once and Orbit shows them on your week and reminds you what is next.</EmptyState>
      ) : (
        <ul className="class-list">
          {[...classes].sort((a, b) => a.start.localeCompare(b.start)).map((c) => (
            <li key={c.id}>
              <div>
                <strong>{c.name}</strong>
                <span>{WEEK_ORDER.filter((d) => c.days.includes(d)).map((d) => DAY_NAMES[d].slice(0, 3)).join(" ")} · {clockLabel(c.start)}–{clockLabel(c.end)}</span>
                {c.place && <span><MapPin size={12} aria-hidden="true" /> {c.place}</span>}
              </div>
              <button type="button" className="ghost-btn" aria-label={`Remove ${c.name}`} onClick={() => remove(c.id, c.name)}><Trash2 size={15} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
