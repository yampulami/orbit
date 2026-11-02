import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Check, Plus, Search, Trash2, Wand2 } from "lucide-react";
import Picker from "../../components/Picker";
import { YOU } from "../../lib/hangouts";
import { POINTS, removeWithUndo, roomActions, type Points, type Space } from "../../lib/roommates";
import { fromYmd, ymd } from "../../lib/reminders";
import { memberOptions } from "./Avatar";
import { ArrangeItem, ArrangeList } from "../../components/Arrange";
import { applyOrder, mergeOrder, useSavedOrder } from "../../lib/order";

type Filter = "open" | "mine" | "done";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "open", label: "Open" }, { value: "mine", label: "Mine" }, { value: "done", label: "Done" }
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
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState("");
  const [draft, setDraft] = useState("");

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

  /** j and k (or the arrow keys) move between the chores' tick boxes. */
  function rowKeys(e: KeyboardEvent<HTMLElement>) {
    if ((e.target as HTMLElement).matches("input,textarea,select")) return;
    const down = e.key === "j" || e.key === "ArrowDown", up = e.key === "k" || e.key === "ArrowUp";
    if (!down && !up) return;
    const boxes = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>(".rm-row .check"));
    const at = boxes.indexOf(document.activeElement as HTMLButtonElement);
    const next = boxes[Math.max(0, Math.min(boxes.length - 1, at < 0 ? 0 : at + (down ? 1 : -1)))];
    if (next) { e.preventDefault(); next.focus(); }
  }

  function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Name the chore first."); return; }
    roomActions.addTask(title.trim(), who, points, due || undefined);
    setTitle(""); setDue(""); setError(""); setExpanded(false);
  }

  return (
    <div className="rm-card" onKeyDown={rowKeys}>
      <form className="rm-add" data-tone="lav" data-collapsed={expanded || title ? undefined : ""} onSubmit={add}>
        <label className="field grow"><span className="sr">Chore</span><input value={title} onFocus={() => setExpanded(true)} onChange={(e) => setTitle(e.target.value)} placeholder="Add a chore, like “Clean the bathroom”" maxLength={80} /></label>
        <div className="rm-extra"><Picker value={who} options={assignOptions} onChange={setWho} label="Assign to" />
        <div className="segment" role="radiogroup" aria-label="Effort points"><span className="rm-lbl" aria-hidden="true">Effort</span>
          {POINTS.map((p) => <button key={p} type="button" role="radio" aria-checked={points === p} onClick={() => setPoints(p)} title={`${p} effort point${p === 1 ? "" : "s"}`}>{p}</button>)}
        </div>
        <label className="field due"><span className="sr">Due date (optional)</span><input type="date" value={due} min={today} onChange={(e) => setDue(e.target.value)} title="Due date (optional)" /></label></div>
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
                {editing === t.id ? (
                  <input className="rm-edit-input" autoFocus aria-label={`Rename ${t.title}`} value={draft} maxLength={80} onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => { roomActions.rename(t.id, draft); setEditing(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { roomActions.rename(t.id, draft); setEditing(""); } else if (e.key === "Escape") setEditing(""); e.stopPropagation(); }} />
                ) : (
                  <strong><button type="button" className="rm-edit" title="Click to rename" onClick={() => { setDraft(t.title); setEditing(t.id); }}>{t.title}</button></strong>
                )}
                <span className="rm-sub">{t.points} point{t.points === 1 ? "" : "s"}{t.done ? ` · done ${ago(t.doneAt)}` : ""}{!t.done && t.due ? <> · <span className={t.due < today ? "late" : ""}>{t.due < today ? "was due " : "due "}{fromYmd(t.due).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span></> : null}</span>
              </div>
              <Picker compact value={t.assignee} options={people} onChange={(v) => roomActions.reassign(t.id, v)} label={`Assigned to, ${t.title}`} />
              <button type="button" className="ghost-btn" aria-label={`Delete ${t.title}`} onClick={() => removeWithUndo("tasks", t.id, `“${t.title}”`)}><Trash2 size={16} aria-hidden="true" /></button>
            </ArrangeItem>
          ))}
        </ArrangeList>
      )}
      <p className="rm-foot">Effort points count bigger chores more, so “fair” means similar points, not similar numbers of chores. Press j and k to move between chores, then Space to tick one off.</p>
    </div>
  );
}
