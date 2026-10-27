import { siteUrl } from "../lib/siteUrl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CalendarPlus, Copy, KeyRound, Plus, Send, UserPlus, Users } from "lucide-react";
import EmojiButton from "../components/EmojiButton";
import DateTimeField from "../components/DateTimeField";
import { useChatOpenClass, useIsPhone } from "../lib/phone";
import RichText from "../components/RichText";
import HangoutCard from "../components/HangoutCard";
import FriendsPanel from "../components/FriendsPanel";
import GroupAddFriend from "../components/GroupAddFriend";
import { useFriends } from "../lib/friends";
import { findConflict, hangActions, hangLive, useHang, useHangStatus, YOU } from "../lib/hangouts";
import { notice } from "../lib/notice";
import { useMapPlaces } from "../lib/mapPlaces";
import { enter, slide } from "../lib/motion";

export default function Groups() {
  const { groups, hangouts } = useHang();
  const status = useHangStatus();
  const loc = useLocation();
  const nav = useNavigate();
  const { live: campusPlaces } = useMapPlaces();
  const phone = useIsPhone();
  const [paneOpen, setPaneOpen] = useState(false); // phone: false shows the list of groups, true shows one group full screen
  // Arriving from the map with a place already chosen opens the plan form with it filled in.
  const fromMap = (loc.state as { place?: string } | null)?.place;
  useEffect(() => { if (fromMap) { setPlace(fromMap); setPlanning(true); setAdding(false); setCreating(false); } }, [fromMap, loc.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const asked = (loc.state as { group?: string } | null)?.group;
  const [activeId, setActiveId] = useState(asked && groups.some((g) => g.id === asked) ? asked : groups[0]?.id ?? "");
  useEffect(() => { if (asked && groups.some((g) => g.id === asked)) { setActiveId(asked); setCreating(false); } }, [asked, loc.key]);
  const [text, setText] = useState("");
  const chatInput = useRef<HTMLInputElement>(null);
  useChatOpenClass(phone && paneOpen);
  const [creating, setCreating] = useState(false);
  const [gName, setGName] = useState("");
  const [gMembers, setGMembers] = useState("");
  const [planning, setPlanning] = useState(false);
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [when, setWhen] = useState("");
  const [openToCampus, setOpenToCampus] = useState(false);
  const [adding, setAdding] = useState(false);
  const [friends, setFriends] = useState("");
  const [joining, setJoining] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const { incoming: friendRequests } = useFriends();
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");

  const scroller = useRef<HTMLDivElement>(null);
  const group = groups.find((g) => g.id === activeId) ?? groups[0];
  const showCreate = creating || (groups.length === 0 && status !== "loading" && status !== "idle");
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
    if (hangLive) { setAdding(true); setPlanning(false); } // show the invite code right away
  }

  const inviteLink = (code: string) => `${siteUrl()}/join/${code}`;
  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); notice.show({ icon: "pin", title: `${what} copied`, message: "Send it to the friends you want in this group.", ms: 3500 }); }
    catch { notice.show({ icon: "alert", title: "Could not copy", message: "Select it and copy it by hand." }); }
  }
  async function joinWithCode(e: FormEvent) {
    e.preventDefault();
    const c = joinCode.trim();
    if (!c) return;
    const problem = await hangActions.joinWithCode(c);
    if (problem) { notice.show({ icon: "alert", title: "That code did not work", message: problem }); return; }
    setJoinCode(""); setJoining(false);
    notice.show({ icon: "pin", title: "You are in", message: "The group is on your list.", ms: 3500 });
  }
  async function newCode() {
    if (!group) return;
    const problem = await hangActions.newCode(group.id);
    notice.show(problem ? { icon: "alert", title: "Could not change the code", message: problem } : { icon: "pin", title: "New code made", message: "The old code no longer works.", ms: 3500 });
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
    hangActions.createHangout(group.id, { title: title.trim(), place: place.trim(), when: new Date(when).toISOString(), visibility: openToCampus ? "campus" : "group" });
    setTitle(""); setPlace(""); setWhen(""); setOpenToCampus(false); setPlanning(false); setError("");
  }

  return (
    <div className="page">
      <h1 className="sr">Groups</h1>
      {phone && paneOpen && <button type="button" className="chat-back-bar" onClick={() => setPaneOpen(false)}><ArrowLeft size={18} aria-hidden="true" /> Groups</button>}
      <div className={"chat" + (phone ? (paneOpen ? " phone-chat" : " phone-list") : "")}>
        <div className="threads" aria-label="Your groups">
          {groups.map((g) => (
            <button key={g.id} className={"thread" + (g.id === group?.id && !showCreate && !friendsOpen ? " on" : "")} aria-current={g.id === group?.id && !showCreate && !friendsOpen} onClick={() => { setActiveId(g.id); setFriendsOpen(false); setCreating(false); setPlanning(false); setAdding(false); setError(""); setPaneOpen(true); }}>
              {g.id === group?.id && !showCreate && !friendsOpen && <motion.span layoutId="group-indicator" className="threadpill" transition={slide} />}
              <strong>{g.name}</strong>
              <span className="muted">{g.members.length} people</span>
            </button>
          ))}
          <button className="thread new" onClick={() => { setCreating(true); setFriendsOpen(false); setError(""); setPaneOpen(true); }}><Plus size={16} /> New group</button>
          {hangLive && <button className="thread new" onClick={() => { setFriendsOpen(true); setCreating(false); setError(""); setPaneOpen(true); }} aria-pressed={friendsOpen}><Users size={16} /> Friends{friendRequests.length > 0 && <span className="dm-unread" aria-label={`${friendRequests.length} friend requests`}>{friendRequests.length}</span>}</button>}
          {hangLive && (
            joining ? (
              <form className="join-code" onSubmit={joinWithCode}>
                <label className="sr" htmlFor="join-code">Invite code</label>
                <input id="join-code" autoFocus value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="Invite code" maxLength={20} autoComplete="off" spellCheck={false} />
                <button className="btn primary" disabled={!joinCode.trim()}>Join</button>
              </form>
            ) : <button className="thread new" onClick={() => setJoining(true)}><KeyRound size={16} /> Join with a code</button>
          )}
        </div>

        {friendsOpen && hangLive ? (
          <FriendsPanel />
        ) : showCreate ? (
          <form className="convo card" onSubmit={createGroup}>
            <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
              <h2 style={{ fontSize: "1.4rem" }}>Start a group</h2>
              <label className="field">Group name<input value={gName} onChange={(e) => setGName(e.target.value)} placeholder="e.g. Coffee crew" /></label>
              {hangLive
                ? <p className="muted">When it is made you get a code. Friends who enter it join the group. Only members can see the group.</p>
                : <label className="field">Friends (names, separated by commas)<input value={gMembers} onChange={(e) => setGMembers(e.target.value)} placeholder="Maya, Jordan, Priya" /></label>}
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
                <button className="btn" onClick={() => { setAdding((v) => !v); setPlanning(false); setError(""); }} aria-expanded={adding}><UserPlus size={18} /> {hangLive ? "Add people" : "Add friends"}</button>
                <button className="btn" onClick={() => { setPlanning((v) => !v); setAdding(false); setError(""); }} aria-expanded={planning}><CalendarPlus size={18} /> Plan a hangout</button>
              </div>
            </div>
            {adding && hangLive && (
              <div className="plan-form invite">
                <h3>Add a friend</h3>
                <GroupAddFriend groupId={group.id} groupName={group.name} memberNames={group.members} />
                <h3>Or share the invite code</h3>
                <p className="muted">Friends who enter this code, or open the link, join {group.name}. Only members can see the group and its code.</p>
                {group.code ? (
                  <>
                    <div className="invite-code" aria-label="Invite code">{group.code}</div>
                    <div className="invite-actions">
                      <button type="button" className="btn" onClick={() => copy(group.code!, "Code")}><Copy size={16} aria-hidden="true" /> Copy code</button>
                      <button type="button" className="btn" onClick={() => copy(inviteLink(group.code!), "Link")}><Copy size={16} aria-hidden="true" /> Copy link</button>
                      <button type="button" className="btn invite-new" onClick={newCode}>Make a new code</button>
                    </div>
                  </>
                ) : <p className="muted" role="status">Making your code…</p>}
              </div>
            )}
            {adding && !hangLive && (
              <form className="plan-form" onSubmit={addFriends}>
                <label className="field">Friends (names, separated by commas)<input autoFocus value={friends} onChange={(e) => setFriends(e.target.value)} placeholder="Sam, Riley" /></label>
                {error && <p className="error" role="alert">{error}</p>}
                <button className="btn primary">Add to {group.name}</button>
              </form>
            )}
            {planning && (
              <form className="plan-form" onSubmit={plan}>
                <p className="vis-note plan-intro">A hangout is a plan with your friends. For a big event for the whole campus, look at Campus events in Plans.</p>
                <label className="field">What<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Coffee break" /></label>
                <label className="field">Where<input list="campus-places" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Pick a campus place or type your own" /><datalist id="campus-places">{campusPlaces.map((p) => <option key={p.id} value={p.name} />)}</datalist></label>
                <DateTimeField label="When" value={when} min={nowLocal} onChange={setWhen} />
                {error && <p className="error" role="alert">{error}</p>}
                <div className="field vis" role="radiogroup" aria-label="Who can see it">
                  <span>Who can see it</span>
                  <div className="segment">
                    <button type="button" role="radio" aria-checked={!openToCampus} onClick={() => setOpenToCampus(false)}>Just {group.name}</button>
                    <button type="button" role="radio" aria-checked={openToCampus} onClick={() => setOpenToCampus(true)}>Everyone on campus</button>
                  </div>
                  {openToCampus && <p className="vis-note">Anyone at your university will see this hangout and can say yes. It is still a student hangout, not an official campus event. Official events come from staff in Plans.</p>}
                </div>
                <button className="btn primary">{openToCampus ? "Share with campus" : `Share with ${group.name}`}</button>
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
                    {m.author !== YOU && <strong className="who-name">{m.author}</strong>}<RichText text={m.text ?? ""} />
                  </motion.p>
                );
              })}
            </div>
            <form className="comment-form" onSubmit={send}>
              <input ref={chatInput} aria-label="Message" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${group.name}…`} />
              <EmojiButton value={text} onChange={setText} inputRef={chatInput} />
              <button className="btn primary" aria-label="Send" disabled={!text.trim()}><Send size={16} /></button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
