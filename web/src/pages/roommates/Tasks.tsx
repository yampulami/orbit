import { useState, type FormEvent } from "react";
import { Check, Plus, Search, Trash2, Wand2 } from "lucide-react";
import Picker from "../../components/Picker";
import { YOU } from "../../lib/hangouts";
import { POINTS, removeWithUndo, roomActions, type Points, type Space } from "../../lib/roommates";
import { fromYmd, ymd } from "../../lib/reminders";
import { memberOptions } from "./Avatar";
import { ArrangeItem, ArrangeList } from "../../components/Arrange";
import { applyOrder, mergeOrder, useSavedOrder } from "../../lib/order";

type Filter = "open" | "mine" | "done" | "all";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "open", label: "Open" }, { value: "mine", label: "Mine" }, { value: "done", label: "Done" }, { value: "all", label: "All" },
];

const ago = (iso?: string) => {
  if (!iso) return "";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};

export default function Tasks({ space }: { space: Space }) {
  const [order, setOrder] = useSavedOrder("orbit-chore-order");
  const [filter, setFilter] = useState<Filter>("open");
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [who, setWho] = useState<string>("auto");
  const [points, setPoints] = useState<Points>(2);
  const [due, setDue] = useState("");
  const [error, setError] = useState("");

  const people = memberOptions(space.members);
  const today = ymd(new Date());
  const assignOptions = [{ value: "auto", label: "Auto-assign", icon: <span className="mini auto" aria-hidden="true"><Wand2 size={13} /></span> }, ...people];

  const shown = space.tasks.filter((t) => {
    if (filter === "open" && t.done) return false;
    if (filter === "mine" && (t.done || t.assignee !== YOU)) return false;
    if (filter === "done" && !t.done) return false;
    return !q.trim() || t.title.toLowerCase().includes(q.trim().toLowerCase());
  });
  const ordered = applyOrder(shown, order);

  function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Name the chore first."); return; }
    roomActions.addTask(title.trim(), who, points, due || undefined);
    setTitle(""); setDue(""); setError("");
  }

  return (
    <div className="rm-card">
      <form className="rm-add" data-tone="lav" onSubmit={add}>
        <label className="field grow"><span className="sr">Chore</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a chore, like “Clean the bathroom”" maxLength={80} /></label>
        <Picker value={who} options={assignOptions} onChange={setWho} label="Assign to" />
        <div className="segment" role="radiogroup" aria-label="Effort points">
          {POINTS.map((p) => <button key={p} type="button" role="radio" aria-checked={points === p} onClick={() => setPoints(p)} title={`${p} effort point${p === 1 ? "" : "s"}`}>{p}</button>)}
        </div>
        <label className="field due"><span className="sr">Due date (optional)</span><input type="date" value={due} min={today} onChange={(e) => setDue(e.target.value)} title="Due date (optional)" /></label>
        <button className="btn primary"><Plus size={18} aria-hidden="true" />Add</button>
        {error && <p className="error" role="alert">{error}</p>}
        {who === "auto" && <p className="rm-hint">Goes to whoever has the least open work right now.</p>}
      </form>

      <div className="rm-bar">
        <div className="segment" role="radiogroup" aria-label="Show chores">
          {FILTERS.map((f) => <button key={f.value} type="button" role="radio" aria-checked={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</button>)}
        </div>
        <label className="rm-search"><Search size={16} aria-hidden="true" /><span className="sr">Search chores</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" /></label>
      </div>

      {shown.length === 0 ? (
        <p className="rm-empty">{space.tasks.length === 0 ? "No chores yet. Add the first one above." : "Nothing matches this view."}</p>
      ) : (
        <ArrangeList ids={ordered.map((t) => t.id)} onChange={(ids) => setOrder(mergeOrder(order, ids))} className="rm-list">
          {ordered.map((t) => (
            <ArrangeItem key={t.id} id={t.id} handle label={t.title} className={"rm-row" + (t.done ? " done" : "")}>
              <button type="button" className="check" role="checkbox" aria-checked={t.done} aria-label={`${t.done ? "Reopen" : "Complete"} ${t.title}`} onClick={() => roomActions.setTaskDone(t.id, !t.done)}><Check size={16} strokeWidth={2.4} aria-hidden="true" /></button>
              <div className="rm-main">
                <strong>{t.title}</strong>
                <span className="rm-sub">{t.points} point{t.points === 1 ? "" : "s"}{t.done ? ` · done ${ago(t.doneAt)}` : ""}{!t.done && t.due ? <> · <span className={t.due < today ? "late" : ""}>{t.due < today ? "was due " : "due "}{fromYmd(t.due).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span></> : null}</span>
              </div>
              <Picker compact value={t.assignee} options={people} onChange={(v) => roomActions.reassign(t.id, v)} label={`Assigned to, ${t.title}`} />
              <button type="button" className="ghost-btn" aria-label={`Delete ${t.title}`} onClick={() => removeWithUndo("tasks", t.id, `“${t.title}”`)}><Trash2 size={16} aria-hidden="true" /></button>
            </ArrangeItem>
          ))}
        </ArrangeList>
      )}
      <p className="rm-foot">Effort points count bigger chores more, so “fair” means similar points, not similar numbers of chores.</p>
    </div>
  );
}
