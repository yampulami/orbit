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
import AvatarStack from "../components/AvatarStack";
import MemberPicker, { everyone, usePeopleSets } from "../components/MemberPicker";
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
  const [gPicked, setGPicked] = useState<string[]>([]);
  const [gExtra, setGExtra] = useState<string[]>([]);
  const [aExtra, setAExtra] = useState<string[]>([]);
  const [planning, setPlanning] = useState(false);
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [when, setWhen] = useState("");
  const [openToCampus, setOpenToCampus] = useState(false);
  const [adding, setAdding] = useState(false);
  const [joining, setJoining] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const { incoming: friendRequests } = useFriends();
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");

  const scroller = useRef<HTMLDivElement>(null);
  const sets = usePeopleSets();
  const { friends: myFriends } = useFriends();
  const friendIds = new Map(myFriends.map((f) => [f.name, f.id]));
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
    const members = [...new Set(gPicked.filter((m) => m && m !== YOU))];
    setActiveId(hangActions.createGroup(name, members));
    setGName(""); setGPicked([]); setGExtra([]); setCreating(false); setError("");
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
              <span className="thread-people"><AvatarStack names={g.members.filter((m) => m !== YOU)} max={4} size={24} /><span className="muted">{g.members.length} people</span></span>
            </button>
          ))}
          <button className="thread new" onClick={() => { setCreating(true); setFriendsOpen(false); setError(""); setPaneOpen(true); }}><Plus size={16} /> New group</button>
          {hangLive && <button className="thread new" onClick={() => { setFriendsOpen(true); setCreating(false); setError(""); setPaneOpen(true); }} aria-pressed={friendsOpen}><Users size={16} /> Friends{friendRequests.length > 0 && <span className="dm-unread" aria-label={`${friendRequests.length} friend requests`}>{friendRequests.length}</span>}</button>}
        </div>

        {friendsOpen && hangLive ? (
          <FriendsPanel />
        ) : showCreate ? (
          <form className="convo card" onSubmit={createGroup}>
            <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
              <h2 style={{ fontSize: "1.4rem" }}>Start a group</h2>
              <label className="field">Group name<input value={gName} onChange={(e) => setGName(e.target.value)} placeholder="e.g. Coffee crew" /></label>
              {hangLive
                ? <p className="muted">After it is made, add friends by username. Only members can see the group.</p>
                : (
                  <MemberPicker
                    label="Who is in?"
                    people={[...everyone(sets), ...gExtra.filter((n) => !everyone(sets).some((p) => p.name === n)).map((n) => ({ id: n, name: n }))]}
                    sets={sets}
                    isOn={(p) => gPicked.includes(p.name)}
                    onToggle={(p) => setGPicked((l) => (l.includes(p.name) ? l.filter((x) => x !== p.name) : [...l, p.name]))}
                    onAddNew={(t) => { const n = t.trim().replace(/^@/, ""); setGExtra((l) => (l.includes(n) ? l : [...l, n])); setGPicked((l) => (l.includes(n) ? l : [...l, n])); }}
                  />
                )}
              {error && <p className="error" role="alert">{error}</p>}
              {hangLive && (joining ? (
                <div className="join-code quiet">
                  <label className="sr" htmlFor="join-code">Invite code</label>
                  <input id="join-code" autoFocus value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void joinWithCode(e as unknown as FormEvent); } }} placeholder="Invite code" maxLength={20} autoComplete="off" spellCheck={false} />
                  <button type="button" className="btn" disabled={!joinCode.trim()} onClick={(e) => void joinWithCode(e as unknown as FormEvent)}>Join</button>
                </div>
              ) : <button type="button" className="link-btn quiet-link" onClick={() => setJoining(true)}><KeyRound size={13} aria-hidden="true" /> Have an invite code?</button>)}
            </div>
            <div className="composer-row">
              {groups.length > 0 && <button type="button" className="btn" onClick={() => { setCreating(false); setError(""); }}>Cancel</button>}
              <button className="btn primary">Create group</button>
            </div>
          </form>
        ) : group && (
          <div className="convo card">
            <div className="convo-head">
              <div><h2>{group.name}</h2><div className="convo-people"><AvatarStack people={group.members.filter((m) => m !== YOU).map((m) => ({ name: m, id: friendIds.get(m) }))} max={5} size={30} expandable /><span className="muted">{group.members.length} {group.members.length === 1 ? "person" : "people"}</span></div></div>
              <div className="convo-actions">
                <button className="btn" onClick={() => { setAdding((v) => !v); setPlanning(false); setError(""); }} aria-expanded={adding}><UserPlus size={18} /> {hangLive ? "Add people" : "Add friends"}</button>
                <button className="btn" onClick={() => { setPlanning((v) => !v); setAdding(false); setError(""); }} aria-expanded={planning}><CalendarPlus size={18} /> Plan a hangout</button>
              </div>
            </div>
            {adding && hangLive && (
              <div className="plan-form invite">
                <h3>Add a friend</h3>
                <GroupAddFriend groupId={group.id} groupName={group.name} memberNames={group.members} />
                <details className="invite-more">
                  <summary>Invite with a link instead</summary>
                  <p className="muted">Anyone who opens the link or enters the code joins {group.name}. Only share it with people you trust.</p>
                  {group.code ? (
                    <>
                      <div className="invite-actions">
                        <button type="button" className="btn" onClick={() => copy(inviteLink(group.code!), "Link")}><Copy size={16} aria-hidden="true" /> Copy link</button>
                        <button type="button" className="btn" onClick={() => copy(group.code!, "Code")}><Copy size={16} aria-hidden="true" /> Copy code <span className="invite-code-inline">{group.code}</span></button>
                        <button type="button" className="btn invite-new" onClick={newCode}>Make a new code</button>
                      </div>
                    </>
                  ) : <p className="muted" role="status">Making your code…</p>}
                </details>
              </div>
            )}
            {adding && !hangLive && (
              <div className="plan-form">
                <MemberPicker
                  label={`In ${group.name}`}
                  people={[
                    ...group.members.filter((n) => n !== YOU).map((n) => ({ id: n, name: n })),
                    ...everyone(sets).filter((p) => !group.members.includes(p.name)),
                    ...aExtra.filter((n) => !group.members.includes(n) && !everyone(sets).some((p) => p.name === n)).map((n) => ({ id: n, name: n })),
                  ]}
                  sets={sets}
                  isOn={(p) => group.members.includes(p.name)}
                  locked={(p) => group.members.includes(p.name)}
                  onToggle={(p) => { hangActions.addMembers(group.id, [p.name]); notice.show({ icon: "pin", title: `${p.name} is in ${group.name}`, message: "They can see the chat now.", ms: 3000 }); }}
                  onAddNew={(t) => { const n = t.trim().replace(/^@/, ""); hangActions.addMembers(group.id, [n]); setAExtra((l) => [...l, n]); }}
                />
              </div>
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
