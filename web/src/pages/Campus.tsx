import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BadgeCheck, CalendarDays, ChevronDown, Info, Megaphone, Plus, UserRound, Users } from "lucide-react";
import { eventActions, isOpen, setDemoRole, useCampusEvents, type Role } from "../lib/campusEvents";
import { useCampusOrgs, type Org } from "../lib/campusOrgs";
import { dayLabel, hueFor } from "../lib/look";
import { supabase } from "../lib/supabase";
import { notice } from "../lib/notice";
import EventCard, { EventBadge } from "../components/EventCard";
import EventForm from "../components/EventForm";
import ReviewPanel from "../components/ReviewPanel";
import ClubApplication from "../components/ClubApplication";
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
  const waitingOrgs = orgs.filter((o) => o.status === "pending");
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
  const next = list.find((e) => e.status === "published" && !e.canceled);
  const rest = list.filter((e) => e !== next);
  const shown = all ? rest : rest.slice(0, 6);
  const groups: [string, typeof rest][] = [];
  for (const e of shown) { const k = dayLabel(e.startsAt, now); const g = groups.find((x) => x[0] === k); if (g) g[1].push(e); else groups.push([k, [e]]); }

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
        <>
          {next && <div className="club-next"><h2>Up next on campus</h2><ul className="ev-list"><EventCard e={next} reviewer={reviewer} featured /></ul></div>}
          {groups.map(([label, items]) => (
            <div key={label} className="ev-day"><h3>{label}</h3><ul className="ev-list">{items.map((e) => <EventCard key={e.id} e={e} reviewer={reviewer} />)}</ul></div>
          ))}
        </>
      )}
      {rest.length > 6 && <button type="button" className="up-more" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${rest.length + 1}`}</button>}
    </section>
  );
}

function ClubCard({ o }: { o: Org }) {
  const { events } = useCampusEvents();
  const now = new Date();
  const soon = events.find((e) => e.orgId === o.id && e.status === "published" && !e.canceled && isOpen(e, now));
  return (
    <li>
      <Link className="club-card" style={{ ["--h" as string]: hueFor(o.name) }} to={`/app/campus/clubs/${o.id}`}>
        <span className="club-mark" aria-hidden="true">{o.name.slice(0, 1).toUpperCase()}</span>
        <span className="club-text">
          <strong><RichText text={o.name} />{o.status === "active" && <VerifiedBadge label={o.kind === "official" ? "Verified: official campus office" : "Verified: approved by a coordinator"} />}</strong>
          <span className="club-sub">{o.description || (o.kind === "official" ? "Official office" : "Student club")}</span>
          {soon && <span className="club-soon"><CalendarDays size={12} aria-hidden="true" /> {dayLabel(soon.startsAt, now)}: {soon.title}</span>}
        </span>
        <span className="club-tags">
          {o.status === "active" && <span className="muted club-count"><Users size={12} aria-hidden="true" /> {o.memberCount + o.members.length}</span>}
          {o.status !== "active" && <span className={"ebadge " + (o.status === "paused" ? "no" : "wait")}>{o.status === "pending" ? "Waiting for approval" : o.status === "paused" ? "Paused" : "Not approved"}</span>}
        </span>
      </Link>
    </li>
  );
}

function ClubsView({ mine, all, reviewer }: { mine: Org[]; all: Org[]; reviewer: boolean }) {
  const nav = useNavigate();
  const [creating, setCreating] = useState(false);
  const mineIds = new Set(mine.map((o) => o.id));
  const others = all.filter((o) => !mineIds.has(o.id) && o.status === "active");

  return (
    <section className="clubs" aria-label="Clubs">
      {creating ? (
        <ClubApplication reviewer={reviewer} onCancel={() => setCreating(false)} onSent={(r) => {
          notice.show(r.status === "pending"
            ? { icon: "calendar", title: "Application sent", message: "The coordinators have it now. You will get a notification when they decide. You can add officers while you wait.", ms: 6500 }
            : { icon: "calendar", title: "Created", message: "You can post events from inside it now.", ms: 4000 });
          setCreating(false);
          if (r.id) nav(`/app/campus/clubs/${r.id}`);
        }} />
      ) : (
        <button type="button" className="btn primary create-club" onClick={() => setCreating(true)}><Plus size={16} aria-hidden="true" /> {reviewer ? "Set up a club" : "Apply to start a club"}</button>
      )}

      {mine.length > 0 && (
        <>
          <h3 className="clubs-h">Your clubs</h3>
          <ul className="club-list">{mine.map((o) => <ClubCard key={o.id} o={o} />)}</ul>
        </>
      )}
      <h3 className="clubs-h">Clubs and offices on your campus</h3>
      {others.length === 0
        ? <EmptyState icon={Users} title={mine.length ? "No other clubs yet" : "No clubs yet"}>Apply to start the first one. Once a coordinator approves it, you can post its events to the whole campus.</EmptyState>
        : <ul className="club-list">{others.map((o) => <ClubCard key={o.id} o={o} />)}</ul>}
    </section>
  );
}

export { EventBadge };
