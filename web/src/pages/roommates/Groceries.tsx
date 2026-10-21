import { useState, type FormEvent } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import Picker from "../../components/Picker";
import { CATEGORIES, removeWithUndo, roomActions, type Space } from "../../lib/roommates";

type Filter = "needed" | "bought" | "all";
const FILTERS: { value: Filter; label: string }[] = [{ value: "needed", label: "Needed" }, { value: "bought", label: "Purchased" }, { value: "all", label: "All" }];
const categoryOptions = CATEGORIES.map((c) => ({ value: c as string, label: c }));

export default function Groceries({ space }: { space: Space }) {
  const [filter, setFilter] = useState<Filter>("needed");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("Produce");
  const [error, setError] = useState("");

  const shown = space.groceries.filter((g) => filter === "all" || (filter === "needed" ? !g.bought : g.bought));
  const groups = [...CATEGORIES, ...new Set(space.groceries.map((g) => g.category).filter((c) => !(CATEGORIES as readonly string[]).includes(c)))]
    .map((c) => ({ category: c, items: shown.filter((g) => g.category === c) }))
    .filter((g) => g.items.length > 0);
  const needed = space.groceries.filter((g) => !g.bought).length;

  function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("What do you need?"); return; }
    roomActions.addGrocery(name.trim(), category);
    setName(""); setError("");
  }

  return (
    <div className="rm-card">
      <form className="rm-add" data-tone="mint" onSubmit={add}>
        <label className="field grow"><span className="sr">Item</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add an item, like “Oat milk”" maxLength={60} /></label>
        <Picker value={category} options={categoryOptions} onChange={setCategory} label="Category" />
        <button className="btn primary"><Plus size={18} aria-hidden="true" />Add</button>
        {error && <p className="error" role="alert">{error}</p>}
      </form>

      <div className="rm-bar">
        <div className="segment" role="radiogroup" aria-label="Show items">
          {FILTERS.map((f) => <button key={f.value} type="button" role="radio" aria-checked={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</button>)}
        </div>
        <span className="rm-count" aria-live="polite">{needed} to buy</span>
      </div>

      {groups.length === 0 ? (
        <p className="rm-empty">{space.groceries.length === 0 ? "The list is empty. Add what the house needs." : filter === "needed" ? "Everything is bought." : "Nothing here yet."}</p>
      ) : (
        groups.map((g) => (
          <section key={g.category} className="rm-group" aria-label={g.category}>
            <h3>{g.category}</h3>
            <ul className="rm-list">
              {g.items.map((it) => (
                <li key={it.id} className={"rm-row" + (it.bought ? " done" : "")}>
                  <button type="button" className="check" role="checkbox" aria-checked={it.bought} aria-label={`${it.bought ? "Mark as needed again" : "Mark as purchased"}: ${it.name}`} onClick={() => roomActions.setBought(it.id, !it.bought)}><Check size={16} strokeWidth={2.4} aria-hidden="true" /></button>
                  <div className="rm-main"><strong>{it.name}</strong></div>
                  <button type="button" className="ghost-btn" aria-label={`Delete ${it.name}`} onClick={() => removeWithUndo("groceries", it.id, `“${it.name}”`)}><Trash2 size={16} aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
