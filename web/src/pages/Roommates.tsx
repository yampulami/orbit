import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { Receipt, Scale, ShoppingBasket, StickyNote, ListChecks, UserPlus, type LucideIcon } from "lucide-react";
import { hangActions, YOU } from "../lib/hangouts";
import { roomActions, useSpace } from "../lib/roommates";
import { Avatar } from "./roommates/Avatar";
import Tasks from "./roommates/Tasks";
import Groceries from "./roommates/Groceries";
import Expenses from "./roommates/Expenses";
import Fairness from "./roommates/Fairness";
import Notes from "./roommates/Notes";

type Section = "tasks" | "groceries" | "expenses" | "fairness" | "notes";
const SECTIONS: { id: Section; label: string; Icon: LucideIcon; ink: string }[] = [
  { id: "tasks", label: "Tasks", Icon: ListChecks, ink: "var(--lav-ink)" },
  { id: "groceries", label: "Groceries", Icon: ShoppingBasket, ink: "var(--mint-ink)" },
  { id: "expenses", label: "Expenses", Icon: Receipt, ink: "var(--peach-ink)" },
  { id: "fairness", label: "Fairness", Icon: Scale, ink: "var(--pink-ink)" },
  { id: "notes", label: "House notes", Icon: StickyNote, ink: "var(--butter-ink)" },
];

const names = (s: string) => [...new Set(s.split(",").map((m) => m.trim()).filter((m) => m && m !== YOU))];

export default function Roommates() {
  const space = useSpace();
  const loc = useLocation();
  const asked = (loc.state as { section?: Section } | null)?.section;
  const [section, setSection] = useState<Section>(asked && SECTIONS.some((x) => x.id === asked) ? asked : "tasks");
  // A search result can send you here while you are already on this page.
  useEffect(() => { if (asked && SECTIONS.some((x) => x.id === asked)) setSection(asked); }, [asked, loc.key]);
  const [houseName, setHouseName] = useState("");
  const [others, setOthers] = useState("");
  const [adding, setAdding] = useState(false);
  const [more, setMore] = useState("");
  const [error, setError] = useState("");

  function create(e: FormEvent) {
    e.preventDefault();
    if (!houseName.trim()) { setError("Give your household a name."); return; }
    roomActions.createSpace(houseName.trim(), names(others));
    setHouseName(""); setOthers(""); setError("");
  }

  function addMore(e: FormEvent) {
    e.preventDefault();
    const list = names(more);
    if (list.length === 0) { setError("Type at least one name."); return; }
    roomActions.addMembers(list);
    if (space?.groupId) hangActions.addMembers(space.groupId, list);
    setMore(""); setAdding(false); setError("");
  }

  if (!space) {
    return (
      <div className="page">
        <h1 className="sr">Roommates</h1>
        <form className="rm-setup" onSubmit={create}>
          <h2>Set up your household</h2>
          <p className="muted">One shared place for chores, groceries, bills and house rules. You also get a private group chat for it.</p>
          <label className="field">Household name<input value={houseName} onChange={(e) => setHouseName(e.target.value)} placeholder="e.g. Hamilton 3F" maxLength={40} /></label>
          <label className="field">Your roommates (names, separated by commas)<input value={others} onChange={(e) => setOthers(e.target.value)} placeholder="Maya, Jordan, Priya" /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="rm-setup-actions">
            <button className="btn primary">Create household</button>
            <button type="button" className="btn" onClick={() => roomActions.createSample()}>Try a sample household</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="sr">Roommates</h1>
      <header className="rm-head">
        <div>
          <h2>{space.name}</h2>
          <div className="rm-members" aria-label="Roommates">
            <span className="rm-stack">{space.members.slice(0, 6).map((m) => <Avatar key={m} name={m} members={space.members} size={30} />)}</span>
            <span className="muted">{space.members.map((m) => (m === YOU ? "You" : m)).join(", ")}</span>
          </div>
        </div>
        <button type="button" className="btn" aria-expanded={adding} onClick={() => { setAdding((v) => !v); setError(""); }}><UserPlus size={18} aria-hidden="true" />Add roommates</button>
      </header>
      {adding && (
        <form className="plan-form" onSubmit={addMore}>
          <label className="field">Names, separated by commas<input autoFocus value={more} onChange={(e) => setMore(e.target.value)} placeholder="Sam, Riley" /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn primary">Add to {space.name}</button>
        </form>
      )}

      <div className="pills" role="group" aria-label="Household sections">
        {SECTIONS.map(({ id, label, Icon, ink }) => (
          <button key={id} type="button" className="pill" aria-pressed={section === id} onClick={() => setSection(id)}>
            <span className="dot" style={{ color: ink }}><Icon size={16} strokeWidth={1.9} aria-hidden="true" /></span>{label}
          </button>
        ))}
      </div>

      {section === "tasks" && <Tasks space={space} />}
      {section === "groceries" && <Groceries space={space} />}
      {section === "expenses" && <Expenses space={space} />}
      {section === "fairness" && <Fairness space={space} />}
      {section === "notes" && <Notes space={space} />}
    </div>
  );
}
