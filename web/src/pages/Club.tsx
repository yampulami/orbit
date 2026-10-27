import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, CalendarDays, Check, Clock, MapPin, ClipboardList, Megaphone, MessageSquare, Pause, Play, Plus, ShieldCheck, UserPlus, UserRound, Users, X } from "lucide-react";
import { isOpen, useCampusEvents } from "../lib/campusEvents";
import { canHostEvents, orgActions, eventsNeedApproval, useCampusOrgs } from "../lib/campusOrgs";
import { useClubFeed, lastPostAt } from "../lib/clubFeed";
import { useClubChat } from "../lib/clubChat";
import { useClubPods } from "../lib/clubPods";
import { useClubTasks, isOverdue } from "../lib/clubTasks";
import { activityOf } from "../lib/activity";
import { dayLabel, hueFor } from "../lib/look";
import { notice } from "../lib/notice";
import EventCard from "../components/EventCard";
import EventForm from "../components/EventForm";
import EmptyState from "../components/EmptyState";
import RichText from "../components/RichText";
import VerifiedBadge from "../components/VerifiedBadge";
import ApplicationDetails from "../components/ApplicationDetails";
import { JoinButton, JoinRequests } from "../components/JoinPanel";
import ClubFeed from "../components/ClubFeed";
import ClubAbout from "../components/ClubAbout";
import ClubChat from "../components/ClubChat";
import PodsPanel from "../components/PodsPanel";
import ClubDashboard from "../components/ClubDashboard";
import MyTasks from "../components/MyTasks";
import RolesPanel from "../components/RolesPanel";
import CohostInvites from "../components/CohostInvites";

type Tab = "feed" | "chat" | "dashboard" | "events" | "people" | "about";
const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

/** One club, office or circle: a header in its own colour, then Feed, Events, People and About one tap apart so nothing needs a long scroll. */
export default function Club() {
  const { id } = useParams();
  const nav = useNavigate();
  const { orgs, ready } = useCampusOrgs();
  const { events, canReview: reviewer } = useCampusEvents();
  const [tab, setTab] = useState<Tab>("feed");
  const [roleFor, setRoleFor] = useState("");
  const [posting, setPosting] = useState(false);
  const [past, setPast] = useState(false);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const org = orgs.find((o) => o.id === id);
  const feed = useClubFeed(org?.id ?? "", !!org && (org.status === "active" || org.mine || reviewer));
  const pods = useClubPods(org?.id ?? "", !!org && org.status === "active" && (org.myJoin === "officer" || org.myJoin === "member"));
  const [chatFocus, setChatFocus] = useState("");
  const tasks = useClubTasks(org?.id ?? "", !!org && org.status === "active" && (org.myJoin === "officer" || org.myJoin === "member"));
  const chat = useClubChat(org?.id ?? "", !!org && org.status === "active" && (org.myJoin === "officer" || org.myJoin === "member"));

  if (!org) {
    return (
      <div className="page club-page">
        <Link className="back-link" to="/app/campus"><ArrowLeft size={15} aria-hidden="true" /> Campus</Link>
        {ready ? <EmptyState icon={CalendarDays} title="Club not found">It may have been removed, or it is not on your campus.</EmptyState> : <div className="skeleton sk-tile" aria-busy="true" />}
      </div>
    );
  }

  const now = new Date();
  // Its own events, and events other clubs asked it to co-host and it accepted.
  const all = events.filter((e) => e.orgId === org.id || e.cohosts.some((c) => c.orgId === org.id && c.status === "accepted")).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const upcoming = all.filter((e) => isOpen(e, now) && e.status !== "rejected" && e.status !== "removed");
  const gone = all.filter((e) => !upcoming.includes(e));
  const next = upcoming.find((e) => e.status === "published" && !e.canceled);
  const rest = upcoming.filter((e) => e !== next);
  const groups: [string, typeof rest][] = [];
  for (const e of rest) { const k = dayLabel(e.startsAt, now); const g = groups.find((x) => x[0] === k); if (g) g[1].push(e); else groups.push([k, [e]]); }
  const canPost = org.mine && org.status === "active" && canHostEvents(org) && org.myPerms.includes("events");
  const circle = org.kind === "circle";
  const act = activityOf(events.filter((e) => e.orgId === org.id), lastPostAt(feed.posts), now, org.createdAt || undefined);
  const canRoles = org.owner || org.myPerms.includes("roles");
  const canMembers = org.myPerms.includes("members") || reviewer;
  const waits = eventsNeedApproval(org);
  const people = org.memberCount + org.members.length;
  const requests = canMembers ? org.requests.length : 0;
  const seesApplication = (reviewer || org.mine) && (org.status !== "active" || !!org.application.advisorName);

  async function addOfficer(e: FormEvent) {
    e.preventDefault();
    const r = await orgActions.addMember(org!.id, username, roleFor || undefined);
    if (r) { setError(r); return; }
    setUsername("");
    notice.show({ icon: "calendar", title: "Added to the team", message: roleFor ? "They have the role you picked." : "They can help run the club now.", ms: 3500 });
  }

  return (
    <div className="page club-page" style={{ ["--h" as string]: hueFor(org.name) }}>
      <Link className="back-link" to="/app/campus"><ArrowLeft size={15} aria-hidden="true" /> Campus</Link>

      <header className="club-hero">
        <div className="club-orbits" aria-hidden="true"><i /><i /><i /></div>
        <span className="club-planet" aria-hidden="true">{org.name.slice(0, 1).toUpperCase()}<span className="club-moon" /></span>
        <div className="club-hero-text">
          <h1><RichText text={org.name} />{org.status === "active" && !circle && <VerifiedBadge label={org.kind === "official" ? "Verified: official campus office" : "Verified: approved by a coordinator"} />}</h1>
          <div className="club-tags">
            <span className={"ebadge " + (org.kind === "official" ? "official" : circle ? "group" : "student")}>{org.kind === "official" ? <><BadgeCheck size={12} aria-hidden="true" /> Official</> : circle ? <><Users size={12} aria-hidden="true" /> Student circle</> : <><UserRound size={12} aria-hidden="true" /> Student club</>}</span>
            {org.status === "active" && <span className={"act " + act.level} title={act.line || undefined}><i aria-hidden="true" />{act.label}</span>}
            {org.status === "pending" && <span className="ebadge wait"><Clock size={12} aria-hidden="true" /> Waiting for approval</span>}
            {org.status === "paused" && <span className="ebadge no">Paused</span>}
            {org.status === "rejected" && <span className="ebadge no"><X size={12} aria-hidden="true" /> Not approved</span>}
            {org.application.category && org.status === "active" && <span className="ev-flavor">{org.application.category}</span>}
          </div>
          {org.description && <p className="club-about"><RichText text={org.description} /></p>}
          {org.status === "active" && (
            <div className="club-faces">
              <span className="faces" aria-hidden="true">{org.members.slice(0, 4).map((m) => <i key={m.id}>{initials(m.name)}</i>)}{org.memberCount > 0 && <i className="more">+{org.memberCount}</i>}</span>
              <span className="muted">{people} {people === 1 ? "person" : "people"}{org.application.meeting ? <> · <MapPin size={12} aria-hidden="true" /> {org.application.meeting}</> : null}</span>
            </div>
          )}
          <div className="club-cta">
            <JoinButton org={org} />
            {canPost && <button type="button" className="btn primary" aria-expanded={posting} onClick={() => { setTab("events"); setPosting((v) => !v); }}><Plus size={16} aria-hidden="true" /> Post an event</button>}
          </div>
        </div>
      </header>

      {org.status === "pending" && <p className="cevent-note" role="status">A coordinator needs to approve this club before it can post events. You can add officers while you wait.</p>}
      {org.status === "rejected" && <p className="cevent-note" role="status">Not approved{org.note ? `: ${org.note}` : "."}</p>}
      {org.status === "paused" && <p className="cevent-note" role="status">A coordinator paused this club. It cannot post new events for now.</p>}

      {circle && org.status === "active" && <p className="muted club-circle-note">A student circle is a casual, unofficial group. It is not an approved club, so it cannot post campus events.</p>}
      {act.line && org.status === "active" && <p className="muted club-act-line">{act.label}: {act.line}</p>}

      <div className="segment club-seg" role="tablist" aria-label="Club sections">
        <button type="button" role="tab" aria-selected={tab === "feed"} onClick={() => setTab("feed")}><Megaphone size={15} aria-hidden="true" /> Feed</button>
        {org.mine && org.status === "active" && <button type="button" role="tab" aria-selected={tab === "dashboard"} onClick={() => setTab("dashboard")}><ClipboardList size={15} aria-hidden="true" /> Dashboard{tasks.tasks.some((t) => isOverdue(t, now)) && <span className="rem-count" aria-label="Overdue tasks">!</span>}</button>}
        <button type="button" role="tab" aria-selected={tab === "chat"} onClick={() => setTab("chat")}><MessageSquare size={15} aria-hidden="true" /> Chat{chat.unread > 0 && <span className="rem-count">{chat.unread > 9 ? "9+" : chat.unread}</span>}</button>
        {!circle && <button type="button" role="tab" aria-selected={tab === "events"} onClick={() => setTab("events")}><CalendarDays size={15} aria-hidden="true" /> Events{upcoming.length > 0 && <span className="rem-count">{upcoming.length}</span>}</button>}
        <button type="button" role="tab" aria-selected={tab === "people"} onClick={() => setTab("people")}><Users size={15} aria-hidden="true" /> People{requests > 0 && <span className="rem-count">{requests}</span>}</button>
        <button type="button" role="tab" aria-selected={tab === "about"} onClick={() => setTab("about")}>About</button>
      </div>

      {tab === "feed" && <><MyTasks board={tasks} /><ClubFeed org={org} reviewer={reviewer} feed={feed} /></>}

      {tab === "dashboard" && org.mine && <ClubDashboard org={org} events={events} board={tasks} reviewer={reviewer} go={setTab} />}

      {tab === "chat" && <ClubChat org={org} reviewer={reviewer} chat={chat} pods={pods.pods} focusId={chatFocus} />}

      {tab === "events" && !circle && (
        <section className="club-section" aria-label="Events">
          {canPost && waits && !posting && <p className="muted">New events from this club wait for a coordinator before everyone sees them.</p>}
          {posting && canPost && <EventForm org={org} onDone={() => setPosting(false)} />}
          {!posting && <CohostInvites orgId={org.id} />}
          {!(posting && canPost) && (upcoming.length === 0
            ? <EmptyState icon={CalendarDays} title="Nothing coming up">{canPost ? "Post the first event. It shows to the whole campus once it is live." : org.status === "active" ? "When this club posts one, it shows here." : "Events can be posted once a coordinator approves the club."}</EmptyState>
            : (
              <>
                {next && <div className="club-next"><h2>Up next</h2><ul className="ev-list"><EventCard e={next} reviewer={reviewer} featured /></ul></div>}
                {groups.map(([label, list]) => (
                  <div key={label} className="ev-day"><h3>{label}</h3><ul className="ev-list">{list.map((e) => <EventCard key={e.id} e={e} reviewer={reviewer} />)}</ul></div>
                ))}
              </>
            ))}
          {gone.length > 0 && !(posting && canPost) && (
            <div className="ev-past">
              <button type="button" className="link-btn" aria-expanded={past} onClick={() => setPast((v) => !v)}>{past ? "Hide" : "Show"} past and declined events ({gone.length})</button>
              {past && <ul className="ev-list">{gone.slice().reverse().map((e) => <EventCard key={e.id} e={e} reviewer={reviewer} />)}</ul>}
            </div>
          )}
        </section>
      )}

      {tab === "people" && (
        <>
          <section className="club-section" aria-label="People">
            {canMembers && <JoinRequests org={org} />}
            <h2>Team</h2>
            <ul className="club-people">
              {org.members.map((m) => (
                <li key={m.id}>
                  <i className="club-av" aria-hidden="true">{initials(m.name)}</i>
                  <span className="club-member-name">{m.name}</span>
                  {m.title ? <span className="cf-title-chip">{m.title}</span> : <span className="muted">{m.role === "owner" ? "President" : "Officer"}</span>}
                  {canRoles && m.role !== "owner" && org.roles.length > 0 && (
                    <select className="role-pick" aria-label={`Role for ${m.name}`} value={m.roleId ?? ""} onChange={(e) => e.target.value && void orgActions.setMemberRole(org.id, m.id, e.target.value)}>
                      <option value="">{m.roleId ? "" : "Choose role"}</option>{org.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  )}
                  {(org.owner || org.myPerms.includes("roles")) && m.role !== "owner" && <button type="button" className="link-btn" onClick={() => void orgActions.removeMember(org.id, m.id)}>Remove</button>}
                  {m.name === "You" && m.role !== "owner" && <button type="button" className="link-btn" onClick={async () => { await orgActions.removeMember(org.id, m.id); nav("/app/campus"); }}>Leave</button>}
                </li>
              ))}
            </ul>
            {org.memberCount > 0 && <p className="muted">{org.memberCount} {org.memberCount === 1 ? "member" : "members"} besides the team.</p>}
            {canRoles && (
              <form className="club-add" onSubmit={addOfficer}>
                <label className="sr" htmlFor="club-add-user">Username of the person to add</label>
                <input id="club-add-user" value={username} maxLength={40} placeholder="Add to the team by username" onChange={(e) => { setUsername(e.target.value); setError(""); }} />
                {org.roles.length > 0 && <select className="role-pick" aria-label="Role" value={roleFor} onChange={(e) => setRoleFor(e.target.value)}><option value="">No role</option>{org.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>}
                <button className="btn" disabled={!username.trim()}><UserPlus size={15} aria-hidden="true" /> Add</button>
              </form>
            )}
            {error && <p className="error" role="alert">{error}</p>}
          </section>
          {org.status === "active" && <PodsPanel org={org} pods={pods} openChat={(id) => { void chat.reload(); setChatFocus(id); setTab("chat"); }} />}
          {canRoles && org.status === "active" && <RolesPanel org={org} />}
        </>
      )}

      {tab === "about" && (
        <section className="club-section" aria-label="About">
          <ClubAbout key={org.id + org.about + org.description + org.application.meeting + org.application.category} org={org} canEdit={org.owner} />
          {seesApplication && <><h3 className="about-sub">The application</h3><ApplicationDetails org={org} /></>}
          {reviewer && !org.mine && (
            <div className="club-review" role="group" aria-label="Coordinator controls">
              {org.status === "pending" && (declining ? (
                <form className="htools-row" onSubmit={(e) => { e.preventDefault(); void orgActions.decline(org.id, reason); setDeclining(false); }}>
                  <input aria-label="Reason (optional)" autoFocus value={reason} maxLength={200} placeholder="Reason (optional)" onChange={(e) => setReason(e.target.value)} />
                  <button className="btn danger">Decline</button><button type="button" className="btn" onClick={() => setDeclining(false)}>Back</button>
                </form>
              ) : (
                <>
                  <button type="button" className="btn primary" onClick={() => { void orgActions.approve(org.id); notice.show({ icon: "calendar", title: `${org.name} approved`, message: "Its officers can post events now.", ms: 4000 }); }}><Check size={15} aria-hidden="true" /> Approve club</button>
                  <button type="button" className="btn" onClick={() => setDeclining(true)}>Decline</button>
                </>
              ))}
              {org.status === "active" && org.kind === "student" && <button type="button" className="btn" aria-pressed={org.trusted} onClick={() => void orgActions.setTrusted(org.id, !org.trusted)}><ShieldCheck size={14} aria-hidden="true" /> {org.trusted ? "Stop trusting" : "Trust this club"}</button>}
              {org.status === "active" && <button type="button" className="btn" onClick={() => void orgActions.setPaused(org.id, true)}><Pause size={14} aria-hidden="true" /> Pause</button>}
              {org.status === "paused" && <button type="button" className="btn" onClick={() => void orgActions.setPaused(org.id, false)}><Play size={14} aria-hidden="true" /> Resume</button>}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
