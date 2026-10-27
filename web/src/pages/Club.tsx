import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, CalendarDays, Check, Clock, Pause, Play, Plus, ShieldCheck, UserRound, UserPlus, X } from "lucide-react";
import { useCampusEvents } from "../lib/campusEvents";
import { orgActions, eventsNeedApproval, useCampusOrgs } from "../lib/campusOrgs";
import { notice } from "../lib/notice";
import EventCard from "../components/EventCard";
import EventForm from "../components/EventForm";
import EmptyState from "../components/EmptyState";
import RichText from "../components/RichText";
import VerifiedBadge from "../components/VerifiedBadge";
import ApplicationDetails from "../components/ApplicationDetails";
import { JoinButton, JoinRequests } from "../components/JoinPanel";

/** One club or office: who runs it, its events, and (for its officers) the button that posts a new event. */
export default function Club() {
  const { id } = useParams();
  const nav = useNavigate();
  const { orgs, ready } = useCampusOrgs();
  const { events, canReview: reviewer } = useCampusEvents();
  const [posting, setPosting] = useState(false);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const org = orgs.find((o) => o.id === id);

  if (!org) {
    return (
      <div className="page club-page">
        <Link className="back-link" to="/app/campus"><ArrowLeft size={15} aria-hidden="true" /> Campus</Link>
        {ready ? <EmptyState icon={CalendarDays} title="Club not found">It may have been removed, or it is not on your campus.</EmptyState> : <div className="skeleton sk-tile" aria-busy="true" />}
      </div>
    );
  }

  const mineEvents = events.filter((e) => e.orgId === org.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const canPost = org.mine && org.status === "active";
  const waits = eventsNeedApproval(org);

  async function addOfficer(e: FormEvent) {
    e.preventDefault();
    const r = await orgActions.addMember(org!.id, username);
    if (r) { setError(r); return; }
    setUsername("");
    notice.show({ icon: "calendar", title: "Officer added", message: "They can post events for this club now.", ms: 3500 });
  }

  return (
    <div className="page club-page">
      <Link className="back-link" to="/app/campus"><ArrowLeft size={15} aria-hidden="true" /> Campus</Link>
      <header className="club-head">
        <span className="club-mark big" aria-hidden="true">{org.name.slice(0, 1).toUpperCase()}</span>
        <div>
          <h1><RichText text={org.name} />{org.status === "active" && <VerifiedBadge label={org.kind === "official" ? "Verified: official campus office" : "Verified: approved by a coordinator"} />}</h1>
          <div className="club-tags">
            <span className={"ebadge " + (org.kind === "official" ? "official" : "student")}>{org.kind === "official" ? <><BadgeCheck size={12} aria-hidden="true" /> Official</> : <><UserRound size={12} aria-hidden="true" /> Student club</>}</span>
            {org.status === "pending" && <span className="ebadge wait"><Clock size={12} aria-hidden="true" /> Waiting for approval</span>}
            {org.status === "paused" && <span className="ebadge no">Paused</span>}
            {org.status === "rejected" && <span className="ebadge no"><X size={12} aria-hidden="true" /> Not approved</span>}
            {org.status === "active" && <span className="muted">{org.memberCount + org.members.length} {org.memberCount + org.members.length === 1 ? "person" : "people"}</span>}
          </div>
        </div>
      </header>
      {org.description && <p className="club-about"><RichText text={org.description} /></p>}

      <JoinButton org={org} />
      {(reviewer || org.mine) && org.status !== "active" && <ApplicationDetails org={org} />}
      {org.status === "pending" && <p className="cevent-note" role="status">A coordinator needs to approve this club before it can post events. You can add officers while you wait.</p>}
      {org.status === "rejected" && <p className="cevent-note" role="status">Not approved{org.note ? `: ${org.note}` : "."}</p>}
      {org.status === "paused" && <p className="cevent-note" role="status">A coordinator paused this club. It cannot post new events for now.</p>}

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

      <section className="club-section" aria-label="Events">
        <div className="cevents-top">
          <h2>Events</h2>
          {canPost && <button type="button" className="btn primary" aria-expanded={posting} onClick={() => setPosting((v) => !v)}><Plus size={16} aria-hidden="true" /> Post an event</button>}
        </div>
        {canPost && waits && !posting && <p className="muted">New events from this club wait for a coordinator before everyone sees them.</p>}
        {posting && canPost && <EventForm org={org} onDone={() => setPosting(false)} />}
        {mineEvents.length === 0
          ? <EmptyState icon={CalendarDays} title="No events yet">{canPost ? "Post the first one. It shows to the whole campus once it is live." : org.status === "active" ? "When this club posts one, it shows here." : "Events can be posted once a coordinator approves the club."}</EmptyState>
          : <ul className="cevent-list">{mineEvents.map((e) => <EventCard key={e.id} e={e} reviewer={reviewer} />)}</ul>}
      </section>

      {(org.mine || reviewer) && <JoinRequests org={org} />}

      <section className="club-section" aria-label="Officers">
        <h2>Officers</h2>
        <ul className="club-members">
          {org.members.map((m) => (
            <li key={m.id}>
              <span className="club-member-name">{m.name}</span><span className="muted">{m.role === "owner" ? "Owner" : "Officer"}</span>
              {org.owner && m.role !== "owner" && <button type="button" className="link-btn" onClick={() => void orgActions.removeMember(org.id, m.id)}>Remove</button>}
              {m.name === "You" && m.role !== "owner" && <button type="button" className="link-btn" onClick={async () => { await orgActions.removeMember(org.id, m.id); nav("/app/campus"); }}>Leave</button>}
            </li>
          ))}
        </ul>
        {org.owner && (
          <form className="club-add" onSubmit={addOfficer}>
            <label className="sr" htmlFor="club-add-user">Username of the new officer</label>
            <input id="club-add-user" value={username} maxLength={40} placeholder="Add an officer by username" onChange={(e) => { setUsername(e.target.value); setError(""); }} />
            <button className="btn" disabled={!username.trim()}><UserPlus size={15} aria-hidden="true" /> Add</button>
          </form>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </section>
    </div>
  );
}
