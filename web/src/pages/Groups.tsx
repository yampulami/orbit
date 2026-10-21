import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarPlus, Plus, Send, UserPlus } from "lucide-react";
import HangoutCard from "../components/HangoutCard";
import { findConflict, hangActions, useHang, YOU } from "../lib/hangouts";
import { notice } from "../lib/notice";
import { useMapPlaces } from "../lib/mapPlaces";
import { enter, slide } from "../lib/motion";

export default function Groups() {
  const { groups, hangouts } = useHang();
  const loc = useLocation();
  const nav = useNavigate();
  const { live: campusPlaces } = useMapPlaces();
  // Arriving from the map with a place already chosen opens the plan form with it filled in.
  const fromMap = (loc.state as { place?: string } | null)?.place;
  useEffect(() => { if (fromMap) { setPlace(fromMap); setPlanning(true); setAdding(false); setCreating(false); } }, [fromMap, loc.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const asked = (loc.state as { group?: string } | null)?.group;
  const [activeId, setActiveId] = useState(asked && groups.some((g) => g.id === asked) ? asked : groups[0]?.id ?? "");
  useEffect(() => { if (asked && groups.some((g) => g.id === asked)) { setActiveId(asked); setCreating(false); } }, [asked, loc.key]);
  const [text, setText] = useState("");
  const [creating, setCreating] = useState(false);
  const [gName, setGName] = useState("");
  const [gMembers, setGMembers] = useState("");
  const [planning, setPlanning] = useState(false);
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [when, setWhen] = useState("");
  const [adding, setAdding] = useState(false);
  const [friends, setFriends] = useState("");
  const [error, setError] = useState("");

  const scroller = useRef<HTMLDivElement>(null);
  const group = groups.find((g) => g.id === activeId) ?? groups[0];
  const showCreate = creating || groups.length === 0;
  const messageCount = group?.messages.length ?? 0;
  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; }, [group?.id, messageCount, showCreate]);
  // The native date picker needs a "now" in its own format so it can refuse past times.
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  function createGroup(e: FormEvent) {
    e.preventDefault();
    const name = gName.trim();
    if (!name) { notice.show({ title: "Name your group", message: "Give the group a name so everyone knows which chat it is." }); return; }
    const members = [...new Set(gMembers.split(",").map((m) => m.trim()).filter((m) => m && m !== YOU))];
    setActiveId(hangActions.createGroup(name, members));
    setGName(""); setGMembers(""); setCreating(false); setError("");
  }

  function send(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!group || !t) return;
    hangActions.send(group.id, t);
    setText("");
  }

  function addFriends(e: FormEvent) {
    e.preventDefault();
    if (!group) return;
    const names = [...new Set(friends.split(",").map((m) => m.trim()).filter((m) => m && m !== YOU))];
    if (names.length === 0) { notice.show({ title: "Who are you adding?", message: "Type at least one name, separated by commas." }); return; }
    hangActions.addMembers(group.id, names);
    setFriends(""); setAdding(false); setError("");
  }

  function plan(e: FormEvent) {
    e.preventDefault();
    if (!group) return;
    if (!title.trim() || !place.trim() || !when) { notice.show({ title: "Almost there", message: "Add a title, a place and a time so your friends know what they are saying yes to." }); return; }
    const iso = new Date(when).toISOString();
    if (new Date(iso).getTime() < Date.now()) { notice.show({ icon: "calendar", title: "That time has passed", message: "Pick a time that is still ahead of you." }); return; }
    const clash = findConflict(iso);
    if (clash) {
      const at = new Date(clash.when);
      notice.show({
        icon: "calendar", title: "You already have plans then",
        message: `"${clash.title}" is on ${at.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })} at ${at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}. Pick a different time, or cancel that one first.`,
        actions: [{ label: "See it on the calendar", onClick: () => nav("/app/plans", { state: { day: at.toDateString() } }) }],
      });
      return;
    }
    hangActions.createHangout(group.id, { title: title.trim(), place: place.trim(), when: new Date(when).toISOString() });
    setTitle(""); setPlace(""); setWhen(""); setPlanning(false); setError("");
  }

  return (
    <div className="page">
      <h1 className="sr">Groups</h1>
      <div className="chat">
        <div className="threads" aria-label="Your groups">
          {groups.map((g) => (
            <button key={g.id} className={"thread" + (g.id === group?.id && !showCreate ? " on" : "")} aria-current={g.id === group?.id && !showCreate} onClick={() => { setActiveId(g.id); setCreating(false); setPlanning(false); setAdding(false); setError(""); }}>
              {g.id === group?.id && !showCreate && <motion.span layoutId="group-indicator" className="threadpill" transition={slide} />}
              <strong>{g.name}</strong>
              <span className="muted">{g.members.length} people</span>
            </button>
          ))}
          <button className="thread new" onClick={() => { setCreating(true); setError(""); }}><Plus size={16} /> New group</button>
        </div>

        {showCreate ? (
          <form className="convo card" onSubmit={createGroup}>
            <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
              <h2 style={{ fontSize: "1.4rem" }}>Start a group</h2>
              <label className="field">Group name<input value={gName} onChange={(e) => setGName(e.target.value)} placeholder="e.g. Coffee crew" /></label>
              <label className="field">Friends (names, separated by commas)<input value={gMembers} onChange={(e) => setGMembers(e.target.value)} placeholder="Maya, Jordan, Priya" /></label>
              {error && <p className="error" role="alert">{error}</p>}
            </div>
            <div className="composer-row">
              {groups.length > 0 && <button type="button" className="btn" onClick={() => { setCreating(false); setError(""); }}>Cancel</button>}
              <button className="btn primary">Create group</button>
            </div>
          </form>
        ) : group && (
          <div className="convo card">
            <div className="convo-head">
              <div><h2>{group.name}</h2><p className="muted">{group.members.join(", ")}</p></div>
              <div className="convo-actions">
                <button className="btn" onClick={() => { setAdding((v) => !v); setPlanning(false); setError(""); }} aria-expanded={adding}><UserPlus size={18} /> Add friends</button>
                <button className="btn" onClick={() => { setPlanning((v) => !v); setAdding(false); setError(""); }} aria-expanded={planning}><CalendarPlus size={18} /> Plan a hangout</button>
              </div>
            </div>
            {adding && (
              <form className="plan-form" onSubmit={addFriends}>
                <label className="field">Friends (names, separated by commas)<input autoFocus value={friends} onChange={(e) => setFriends(e.target.value)} placeholder="Sam, Riley" /></label>
                {error && <p className="error" role="alert">{error}</p>}
                <button className="btn primary">Add to {group.name}</button>
              </form>
            )}
            {planning && (
              <form className="plan-form" onSubmit={plan}>
                <label className="field">What<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Coffee break" /></label>
                <label className="field">Where<input list="campus-places" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Pick a campus place or type your own" /><datalist id="campus-places">{campusPlaces.map((p) => <option key={p.id} value={p.name} />)}</datalist></label>
                <label className="field">When<input type="datetime-local" min={nowLocal} value={when} onChange={(e) => setWhen(e.target.value)} /></label>
                {error && <p className="error" role="alert">{error}</p>}
                <button className="btn primary">Share with {group.name}</button>
              </form>
            )}
            <div className="bubbles" ref={scroller}>
              {group.messages.length === 0 && <p className="muted">No messages yet. Say hi, then plan something.</p>}
              {group.messages.map((m) => {
                const h = m.hangoutId ? hangouts.find((x) => x.id === m.hangoutId) : undefined;
                if (m.hangoutId) {
                  if (!h) return null;
                  if (h.canceled) return <p key={m.id} className="chat-note">“{h.title}” was canceled</p>;
                  return <div key={m.id} className="chat-hang"><HangoutCard h={h} group={group.name} tone={1} plain /></div>;
                }
                return (
                  <motion.p key={m.id} title={new Date(m.at).toLocaleString()} className={"bubble" + (m.author === YOU ? " mine" : "")} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={enter}>
                    {m.author !== YOU && <strong className="who-name">{m.author}</strong>}{m.text}
                  </motion.p>
                );
              })}
            </div>
            <form className="comment-form" onSubmit={send}>
              <input aria-label="Message" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${group.name}…`} />
              <button className="btn primary" aria-label="Send" disabled={!text.trim()}><Send size={16} /></button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
