import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BadgeCheck, CalendarDays, ChevronDown, Info, Megaphone, Plus, UserRound, Users } from "lucide-react";
import { eventActions, isOpen, setDemoRole, useCampusEvents, type Role } from "../lib/campusEvents";
import { orgActions, useCampusOrgs, type Org } from "../lib/campusOrgs";
import { supabase } from "../lib/supabase";
import { notice } from "../lib/notice";
import EventCard, { EventBadge } from "../components/EventCard";
import EventForm from "../components/EventForm";
import ReviewPanel from "../components/ReviewPanel";
import EmptyState from "../components/EmptyState";
import RichText from "../components/RichText";
import VerifiedBadge from "../components/VerifiedBadge";

type Tab = "events" | "clubs" | "review";

/** Campus: the public side of Orbit. Events everyone on campus can see, and the clubs and offices that put them on. A club is set up first (a coordinator
 *  approves it), and its events are posted from inside the club. Coordinators also get a Review tab. */
export default function Campus() {
  const { events, pending, reported, isHost, role, canReview: reviewer, hostLabel, ready } = useCampusEvents();
  const { orgs, mine } = useCampusOrgs();
  const [tab, setTab] = useState<Tab>("events");
  const waitingOrgs = orgs.filter((o) => o.status === "pending" && !o.mine);
  const reviewCount = reviewer ? pending.length + reported.length + waitingOrgs.length : 0;
  const current: Tab = tab === "review" && !reviewer ? "events" : tab;

  return (
    <div className="page campus">
      <h1 className="sr">Campus</h1>
      <header className="campus-head">
        <div>
          <h2><Megaphone size={20} aria-hidden="true" /> Campus</h2>
          <p className="muted">Events for the whole university, and the clubs and offices behind them.</p>
        </div>
        <div className="segment campus-seg" role="tablist" aria-label="Campus sections">
          <button type="button" role="tab" aria-selected={current === "events"} onClick={() => setTab("events")}>Events</button>
          <button type="button" role="tab" aria-selected={current === "clubs"} onClick={() => setTab("clubs")}>Clubs</button>
          {reviewer && <button type="button" role="tab" aria-selected={current === "review"} onClick={() => setTab("review")}>Review{reviewCount > 0 && <span className="rem-count">{reviewCount}</span>}</button>}
        </div>
      </header>

      {!supabase && (
        <label className="cevent-demo">Preview as
          <select value={role ?? "coordinator"} onChange={(e) => setDemoRole(e.target.value as Role)}>
            <option value="coordinator">Coordinator (approves clubs and events)</option>
            <option value="staff">Staff (publishes Official events)</option>
            <option value="student">Student (a club officer)</option>
          </select>
        </label>
      )}

      {current === "events" && <EventsView events={events} ready={ready} isHost={isHost} role={role} hostLabel={hostLabel} reviewer={reviewer} />}
      {current === "clubs" && <ClubsView mine={mine} all={orgs} reviewer={reviewer} />}
      {current === "review" && reviewer && <ReviewPanel />}
    </div>
  );
}

function Explainer() {
  const [help, setHelp] = useState(false);
  return (
    <>
      <button type="button" className="cevent-help" aria-expanded={help} onClick={() => setHelp((v) => !v)}><Info size={15} aria-hidden="true" /> What is the difference between events and hangouts? <ChevronDown size={15} aria-hidden="true" className="chev" /></button>
      {help && (
        <dl className="cevent-explain">
          <div><dt><span className="ebadge official"><BadgeCheck size={12} aria-hidden="true" /> Official campus event</span></dt><dd>Posted by staff, like a department, the library or an instructor. Open to everyone at your university.</dd></div>
          <div><dt><span className="ebadge student"><UserRound size={12} aria-hidden="true" /> Student event</span></dt><dd>Put on by a student club that a coordinator has approved. Open to everyone. Anyone can report an event if something is wrong.</dd></div>
          <div><dt><span className="ebadge group"><Users size={12} aria-hidden="true" /> Group hangout</span></dt><dd>A private plan you make with friends in a group. Only the people in that group see it, and it is not an event.</dd></div>
        </dl>
      )}
    </>
  );
}

function EventsView({ events, ready, isHost, role, hostLabel, reviewer }: { events: ReturnType<typeof useCampusEvents>["events"]; ready: boolean; isHost: boolean; role: Role | null; hostLabel: string | null; reviewer: boolean }) {
  const [form, setForm] = useState(false);
  const [all, setAll] = useState(false);
  const now = new Date();
  const live = events.filter((e) => isOpen(e, now) && e.status === "published");
  const mineElsewhere = events.filter((e) => e.mineHost && !e.orgId && e.status !== "published" && isOpen(e, now));
  const list = [...mineElsewhere, ...live].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const shown = all ? list : list.slice(0, 6);

  return (
    <section className="cevents" aria-label="Campus events">
      <div className="cevents-top">
        <Explainer />
        {isHost && <button type="button" className="btn" aria-expanded={form} onClick={() => setForm((v) => !v)}><Plus size={16} aria-hidden="true" />Post an event{hostLabel ? ` as ${hostLabel}` : ""}</button>}
      </div>
      {form && isHost && <EventForm hostLabel={hostLabel} role={role} onDone={() => setForm(false)} />}

      {!ready ? (
        <div aria-busy="true" aria-label="Loading campus events"><div className="skeleton sk-tile" /></div>
      ) : list.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No campus events yet">When a department or club posts one, it shows up here and in your bell. Clubs are in the next tab.</EmptyState>
      ) : (
        <ul className="cevent-list">{shown.map((e) => <EventCard key={e.id} e={e} reviewer={reviewer} />)}</ul>
      )}
      {list.length > 6 && <button type="button" className="up-more" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${list.length}`}</button>}
    </section>
  );
}

function ClubCard({ o }: { o: Org }) {
  return (
    <li>
      <Link className="club-card" to={`/app/campus/clubs/${o.id}`}>
        <span className="club-mark" aria-hidden="true">{o.name.slice(0, 1).toUpperCase()}</span>
        <span className="club-text">
          <strong><RichText text={o.name} />{o.status === "active" && <VerifiedBadge label={o.kind === "official" ? "Verified: official campus office" : "Verified: approved by a coordinator"} />}</strong>
          <span className="club-sub">{o.description || (o.kind === "official" ? "Official office" : "Student club")}</span>
        </span>
        <span className="club-tags">
          <span className={"ebadge " + (o.kind === "official" ? "official" : "student")}>{o.kind === "official" ? "Official" : "Club"}</span>
          {o.status !== "active" && <span className={"ebadge " + (o.status === "paused" ? "no" : "wait")}>{o.status === "pending" ? "Waiting for approval" : o.status === "paused" ? "Paused" : "Not approved"}</span>}
        </span>
      </Link>
    </li>
  );
}

function ClubsView({ mine, all, reviewer }: { mine: Org[]; all: Org[]; reviewer: boolean }) {
  const nav = useNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [office, setOffice] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mineIds = new Set(mine.map((o) => o.id));
  const others = all.filter((o) => !mineIds.has(o.id) && o.status === "active");

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await orgActions.request({ name, description: about, reviewer, kind: reviewer && office ? "official" : "student" });
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    notice.show(r.status === "pending"
      ? { icon: "calendar", title: "Club created", message: "A coordinator needs to approve it before it can post events. You can set it up and add officers now.", ms: 6000 }
      : { icon: "calendar", title: "Created", message: "You can post events from inside it now.", ms: 4000 });
    setCreating(false); setName(""); setAbout("");
    if (r.id) nav(`/app/campus/clubs/${r.id}`);
  }

  return (
    <section className="clubs" aria-label="Clubs">
      {creating ? (
        <form className="htools-form club-create" onSubmit={create}>
          <h3>Create a club</h3>
          <p className="muted">Set the club up first. A coordinator approves it, and then you post its events from inside the club.</p>
          <label className="field">Name<input autoFocus value={name} maxLength={80} placeholder="e.g. Chess Club" onChange={(e) => { setName(e.target.value); setError(""); }} /></label>
          <label className="field">What is it? (a line or two)<textarea rows={2} value={about} maxLength={300} placeholder="Who it is for and what you do." onChange={(e) => setAbout(e.target.value)} /></label>
          {reviewer && <label className="check-line"><input type="checkbox" checked={office} onChange={(e) => setOffice(e.target.checked)} /> This is a staff-run office (its events are Official)</label>}
          {error && <p className="error" role="alert">{error}</p>}
          <div className="about-actions"><button className="btn primary" disabled={busy}>{busy ? "Creating…" : "Create club"}</button><button type="button" className="btn" onClick={() => setCreating(false)}>Cancel</button></div>
        </form>
      ) : (
        <button type="button" className="btn primary create-club" onClick={() => setCreating(true)}><Plus size={16} aria-hidden="true" /> Create a club</button>
      )}

      {mine.length > 0 && (
        <>
          <h3 className="clubs-h">Your clubs</h3>
          <ul className="club-list">{mine.map((o) => <ClubCard key={o.id} o={o} />)}</ul>
        </>
      )}
      <h3 className="clubs-h">Clubs and offices on your campus</h3>
      {others.length === 0
        ? <EmptyState icon={Users} title={mine.length ? "No other clubs yet" : "No clubs yet"}>Start the first one. Once a coordinator approves it, you can post its events to the whole campus.</EmptyState>
        : <ul className="club-list">{others.map((o) => <ClubCard key={o.id} o={o} />)}</ul>}
    </section>
  );
}

export { EventBadge };
