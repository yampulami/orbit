import { siteUrl } from "../lib/siteUrl";
import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { CalendarClock, Copy } from "lucide-react";
import { hangActions, hangLive, useHang, YOU } from "../lib/hangouts";
import { notice } from "../lib/notice";
import { money, netBalances, roomActions, useSpace, useSpaceReady, workload } from "../lib/roommates";
import GroupAddFriend from "../components/GroupAddFriend";
import GroupSync from "../components/GroupSync";
import { Avatar } from "./roommates/Avatar";
import Tasks from "./roommates/Tasks";
import Groceries from "./roommates/Groceries";
import Expenses from "./roommates/Expenses";
import Fairness from "./roommates/Fairness";
import Notes from "./roommates/Notes";

type Section = "tasks" | "groceries" | "expenses" | "fairness" | "notes";
const SECTIONS: { id: Section; label: string }[] = [
  { id: "tasks", label: "Tasks" },
  { id: "groceries", label: "Groceries" },
  { id: "expenses", label: "Expenses" },
  { id: "fairness", label: "Fairness" },
  { id: "notes", label: "House notes" },
];

const names = (s: string) => [...new Set(s.split(",").map((m) => m.trim()).filter((m) => m && m !== YOU))];

export default function Roommates() {
  const space = useSpace();
  const ready = useSpaceReady();
  const { groups } = useHang();
  const code = groups.find((g) => g.id === space?.groupId)?.code;
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const loc = useLocation();
  const asked = (loc.state as { section?: Section } | null)?.section;
  const [section, setSection] = useState<Section>(asked && SECTIONS.some((x) => x.id === asked) ? asked : "tasks");
  // A search result can send you here while you are already on this page.
  useEffect(() => { if (asked && SECTIONS.some((x) => x.id === asked)) setSection(asked); }, [asked, loc.key]);
  const [houseName, setHouseName] = useState("");
  const [others, setOthers] = useState("");
  const [adding, setAdding] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [more, setMore] = useState("");
  const [error, setError] = useState("");

  function create(e: FormEvent) {
    e.preventDefault();
    if (!houseName.trim()) { setError("Give your household a name."); return; }
    roomActions.createSpace(houseName.trim(), names(others));
    setHouseName(""); setOthers(""); setError("");
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) { setError("Type the code your roommate sent."); return; }
    setJoining(true);
    const problem = await hangActions.joinWithCode(joinCode);
    setJoining(false);
    if (problem) { setError(problem); return; }
    setJoinCode(""); setError("");
  }

  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); notice.show({ icon: "pin", title: `${what} copied`, message: "Send it to your roommates.", ms: 3500 }); }
    catch { notice.show({ icon: "alert", title: "Could not copy", message: "Select it and copy it by hand." }); }
  }

  function addMore(e: FormEvent) {
    e.preventDefault();
    const list = names(more);
    if (list.length === 0) { setError("Type at least one name."); return; }
    roomActions.addMembers(list);
    if (space?.groupId) hangActions.addMembers(space.groupId, list);
    setMore(""); setAdding(false); setError("");
  }

  if (!space && !ready) {
    return (
      <div className="page" aria-busy="true" aria-label="Loading your household">
        <div className="skeleton sk-card" />
        <div className="skeleton sk-tile" />
        <div className="skeleton sk-tile" />
      </div>
    );
  }

  if (!space) {
    return (
      <div className="page">
        <h1 className="sr">Roommates</h1>
        <div className="rm-setup-grid">
        <form className="rm-setup" onSubmit={create}>
          <h2>Set up your household</h2>
          <p className="muted">One shared place for chores, groceries, bills and house rules. You also get a private group chat for it.</p>
          <label className="field">Household name<input value={houseName} onChange={(e) => setHouseName(e.target.value)} placeholder="e.g. Hamilton 3F" maxLength={40} /></label>
          {!hangLive && <label className="field">Your roommates (names, separated by commas)<input value={others} onChange={(e) => setOthers(e.target.value)} placeholder="Maya, Jordan, Priya" /></label>}
          {error && <p className="error" role="alert">{error}</p>}
          <div className="rm-setup-actions">
            <button className="btn primary">Create household</button>
            {!hangLive && <button type="button" className="btn" onClick={() => roomActions.createSample()}>Try a sample household</button>}
          </div>
        </form>
        {hangLive && (
          <form className="rm-setup" onSubmit={join}>
            <h2>Already have a code?</h2>
            <p className="muted">If a roommate already set up the household, type the code they sent you.</p>
            <label className="field">Invite code<input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="10 letters and numbers" maxLength={10} autoCapitalize="characters" /></label>
            <div className="rm-setup-actions"><button className="btn" disabled={joining}>{joining ? "Joining…" : "Join household"}</button></div>
          </form>
        )}
        </div>
      </div>
    );
  }

  const open = space.tasks.filter((t) => !t.done).length;
  const mine = space.tasks.filter((t) => !t.done && t.assignee === YOU).length;
  const toBuy = space.groceries.filter((g) => !g.bought).length;
  const owed = netBalances(space.members, space.expenses, space.payments)[YOU] ?? 0;
  const load = Object.values(workload(space.members, space.tasks));
  const sentence: Record<Section, string> = {
    tasks: open === 0 ? "Nothing left to do" : `${open} chore${open === 1 ? "" : "s"} open${mine > 0 ? `, ${mine} for you` : ""}`,
    groceries: toBuy === 0 ? "Everything on the list is bought" : `${toBuy} thing${toBuy === 1 ? "" : "s"} to buy`,
    expenses: owed > 0 ? `You are owed ${money(owed)}` : owed < 0 ? `You owe ${money(-owed)}` : "You are all settled",
    fairness: load.length > 0 && Math.max(...load.map((w) => w.open)) - Math.min(...load.map((w) => w.open)) >= 4 ? "Work is uneven this week" : "Work is spread evenly",
    notes: `${space.notes.length} house note${space.notes.length === 1 ? "" : "s"}`,
  };
  const who = space.members.map((m) => (m === YOU ? "You" : m.split(" ")[0]));
  return (
    <div className="page">
      <h1 className="sr">Roommates</h1>
      <header className="rm-head">
        <div>
          <h2>{sentence[section]}</h2>
          <p className="rm-house">
            {space.name} · <button type="button" className="rm-link" aria-expanded={showPeople} onClick={() => setShowPeople((v) => !v)}>{who.slice(0, 4).join(", ")}{who.length > 4 ? ` +${who.length - 4}` : ""}</button>
          </p>
          {showPeople && (
            <ul className="rm-people" aria-label="Roommates">
              {space.members.map((m) => <li key={m}><Avatar name={m} members={space.members} size={28} />{m === YOU ? "You" : m}</li>)}
            </ul>
          )}
        </div>
        <button type="button" className="rm-link" aria-expanded={adding} onClick={() => { setAdding((v) => !v); setError(""); }}>{adding ? "Close" : "Add roommates"}</button>
      </header>
      {adding && (
        hangLive ? (
          <div className="plan-form invite">
            <p className="muted">Add a roommate by their username:</p>
            {space.groupId && <GroupAddFriend groupId={space.groupId} groupName={space.name} memberNames={space.members} />}
            {code ? (
              <>
                <p className="muted">Or send this code, or the link, to your roommates. They paste it under “Already have a code?” on this page, or open the link.</p>
                <div className="invite-code" aria-label="Invite code">{code}</div>
                <div className="invite-actions">
                  <button type="button" className="btn" onClick={() => copy(code, "Code")}><Copy size={16} aria-hidden="true" /> Copy code</button>
                  <button type="button" className="btn" onClick={() => copy(`${siteUrl()}/join/${code}`, "Link")}><Copy size={16} aria-hidden="true" /> Copy link</button>
                </div>
              </>
            ) : <p className="muted">Getting your invite code…</p>}
          </div>
        ) : (
        <form className="plan-form" onSubmit={addMore}>
          <label className="field">Names, separated by commas<input autoFocus value={more} onChange={(e) => setMore(e.target.value)} placeholder="Sam, Riley" /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="rm-setup-actions"><button className="btn primary">Add to {space.name}</button><button type="button" className="rm-link" onClick={() => { setAdding(false); setError(""); }}>Cancel</button></div>
        </form>
        )
      )}

      {space.groupId && hangLive && (
        <div className="rm-sync">
          <button type="button" className="btn" aria-expanded={syncing} onClick={() => setSyncing((v) => !v)}><CalendarClock size={18} aria-hidden="true" />Find a time for the house</button>
          {syncing && <div className="plan-form"><GroupSync groupId={space.groupId} title="When are we all free?" /></div>}
        </div>
      )}

      <div className="rm-tabs" role="tablist" aria-label="Household sections">
        {SECTIONS.map(({ id, label }) => <button key={id} type="button" role="tab" aria-selected={section === id} onClick={() => setSection(id)}>{label}</button>)}
      </div>

      {section === "tasks" && <Tasks space={space} />}
      {section === "groceries" && <Groceries space={space} />}
      {section === "expenses" && <Expenses space={space} />}
      {section === "fairness" && <Fairness space={space} />}
      {section === "notes" && <Notes space={space} />}
    </div>
  );
}
