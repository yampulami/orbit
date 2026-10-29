import { siteUrl } from "../lib/siteUrl";
import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { CalendarClock, Receipt, Scale, ShoppingBasket, StickyNote, ListChecks, UserPlus, Copy, type LucideIcon } from "lucide-react";
import { hangActions, hangLive, useHang, YOU } from "../lib/hangouts";
import { notice } from "../lib/notice";
import { roomActions, useSpace, useSpaceReady } from "../lib/roommates";
import GroupAddFriend from "../components/GroupAddFriend";
import GroupSync from "../components/GroupSync";
import { Avatar } from "./roommates/Avatar";
import GradientMenu, { type GMItem } from "../components/GradientMenu";
import Tasks from "./roommates/Tasks";
import Groceries from "./roommates/Groceries";
import Expenses from "./roommates/Expenses";
import Fairness from "./roommates/Fairness";
import Notes from "./roommates/Notes";

type Section = "tasks" | "groceries" | "expenses" | "fairness" | "notes";
const SECTIONS: { id: Section; label: string; Icon: LucideIcon; tone: GMItem["tone"] }[] = [
  { id: "tasks", label: "Tasks", Icon: ListChecks, tone: "purple" },
  { id: "groceries", label: "Groceries", Icon: ShoppingBasket, tone: "green" },
  { id: "expenses", label: "Expenses", Icon: Receipt, tone: "orange" },
  { id: "fairness", label: "Fairness", Icon: Scale, tone: "pink" },
  { id: "notes", label: "House notes", Icon: StickyNote, tone: "blue" },
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
          <button className="btn primary">Add to {space.name}</button>
        </form>
        )
      )}

      {space.groupId && hangLive && (
        <div className="rm-sync">
          <button type="button" className="btn" aria-expanded={syncing} onClick={() => setSyncing((v) => !v)}><CalendarClock size={18} aria-hidden="true" />Find a time for the house</button>
          {syncing && <div className="plan-form"><GroupSync groupId={space.groupId} title="When are we all free?" /></div>}
        </div>
      )}

      <GradientMenu
        className="gm-bar"
        label="Household sections"
        items={SECTIONS.map(({ id, label, Icon, tone }): GMItem => ({ key: id, label, icon: Icon, tone, on: section === id, onClick: () => setSection(id) }))}
      />

      {section === "tasks" && <Tasks space={space} />}
      {section === "groceries" && <Groceries space={space} />}
      {section === "expenses" && <Expenses space={space} />}
      {section === "fairness" && <Fairness space={space} />}
      {section === "notes" && <Notes space={space} />}
    </div>
  );
}
