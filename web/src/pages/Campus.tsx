import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BadgeCheck, CalendarDays, ChevronDown, Info, UserRound, Users } from "lucide-react";
import { isOpen, setDemoRole, useCampusEvents, type Role } from "../lib/campusEvents";
import { useCampusOrgs, type Org } from "../lib/campusOrgs";
import { dayLabel, hueFor } from "../lib/look";
import { activityOf } from "../lib/activity";
import { supabase } from "../lib/supabase";
import { notice } from "../lib/notice";
import EventCard from "../components/EventCard";
import EventForm from "../components/EventForm";
import ReviewPanel from "../components/ReviewPanel";
import ClubApplication from "../components/ClubApplication";
import CohostInvites from "../components/CohostInvites";
import AttendedList from "../components/AttendedList";
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
      <header className="campus-head">
        <div>
          <h1 className="campus-title">Campus</h1>
          <p className="muted">Events and clubs across the university.</p>
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
    <div className="explain">
      <button type="button" className="link-btn" aria-expanded={help} onClick={() => setHelp((v) => !v)}><Info size={14} aria-hidden="true" /> Events or hangouts? <ChevronDown size={14} aria-hidden="true" className="chev" /></button>
      {help && (
        <dl className="cevent-explain">
          <div><dt><span className="ebadge official"><BadgeCheck size={12} aria-hidden="true" /> Official campus event</span></dt><dd>Posted by staff, like a department, the library or an instructor. Open to everyone.</dd></div>
          <div><dt><span className="ebadge student"><UserRound size={12} aria-hidden="true" /> Student event</span></dt><dd>Put on by a club a coordinator approved. Open to everyone. Report anything that is wrong.</dd></div>
          <div><dt><span className="ebadge group"><Users size={12} aria-hidden="true" /> Group hangout</span></dt><dd>A private plan with friends in a group. Only the group sees it.</dd></div>
        </dl>
      )}
    </div>
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

  // Posting an event takes over the page, so there is one thing to look at.
  if (form && isHost) return <section className="cevents" aria-label="New event"><EventForm hostLabel={hostLabel} role={role} onDone={() => setForm(false)} /></section>;

  return (
    <section className="cevents" aria-label="Campus events">
      <div className="toolbar">
        <Explainer />
        {isHost && <button type="button" className="btn sm primary" onClick={() => setForm(true)}>Post an event</button>}
      </div>
      <CohostInvites />

      {!ready ? (
        <div aria-busy="true" aria-label="Loading campus events"><div className="skeleton sk-tile" /></div>
      ) : list.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No campus events yet">When a department or club posts one, it shows up here and in your bell.</EmptyState>
      ) : (
        <>
          {next && <div className="club-next"><h2>Up next</h2><ul className="ev-list"><EventCard e={next} reviewer={reviewer} featured /></ul></div>}
          {groups.map(([label, items]) => (
            <div key={label} className="ev-day"><h2>{label}</h2><ul className="ev-list">{items.map((e) => <EventCard key={e.id} e={e} reviewer={reviewer} />)}</ul></div>
          ))}
        </>
      )}
      <AttendedList />
      {rest.length > 6 && <button type="button" className="link-btn more-link" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${rest.length + 1}`}</button>}
    </section>
  );
}

function ClubRow({ o }: { o: Org }) {
  const { events } = useCampusEvents();
  const now = new Date();
  const mine = events.filter((e) => e.orgId === o.id);
  const soon = mine.find((e) => e.status === "published" && !e.canceled && isOpen(e, now));
  const act = activityOf(mine, undefined, now, o.createdAt || undefined);
  const circle = o.kind === "circle";
  const people = o.memberCount + o.members.length;
  return (
    <li>
      <Link className="club-row" style={{ ["--h" as string]: hueFor(o.name) }} to={`/app/campus/clubs/${o.id}`}>
        <span className="club-mark" aria-hidden="true">{o.name.slice(0, 1).toUpperCase()}</span>
        <span className="club-text">
          <strong><RichText text={o.name} />{o.status === "active" && !circle && <VerifiedBadge label={o.kind === "official" ? "Verified: official campus office" : "Verified: approved by a coordinator"} />}</strong>
          <span className="club-sub">{o.description || (o.kind === "official" ? "Official office" : circle ? "Student circle" : "Student club")}</span>
          {soon && <span className="club-soon"><CalendarDays size={12} aria-hidden="true" /> {dayLabel(soon.startsAt, now)}: {soon.title}</span>}
        </span>
        <span className="club-meta">
          {o.status === "active"
            ? <><span className={"act " + act.level} title={act.line || undefined}><i aria-hidden="true" />{act.label}</span><span className="club-count">{people} {people === 1 ? "person" : "people"}</span></>
            : <span className={"ebadge " + (o.status === "paused" ? "no" : "wait")}>{o.status === "pending" ? "Waiting for approval" : o.status === "paused" ? "Paused" : "Not approved"}</span>}
        </span>
      </Link>
    </li>
  );
}

function ClubsView({ mine, all, reviewer }: { mine: Org[]; all: Org[]; reviewer: boolean }) {
  const nav = useNavigate();
  const [creating, setCreating] = useState<"club" | "circle" | null>(null);
  const mineIds = new Set(mine.map((o) => o.id));
  const others = all.filter((o) => !mineIds.has(o.id) && o.status === "active");
  const clubs = others.filter((o) => o.kind !== "circle");
  const circles = others.filter((o) => o.kind === "circle");

  // Starting a club or circle takes over the page: one question at a time, nothing else competing.
  if (creating) {
    return (
      <section className="clubs" aria-label="Start something new">
        <ClubApplication reviewer={reviewer} mode={creating} onCancel={() => setCreating(null)} onSent={(r) => {
          notice.show(creating === "circle"
            ? { icon: "calendar", title: "Your circle is live", message: "Anyone can join it now. Share it, post to its feed, and give people roles.", ms: 5000 }
            : r.status === "pending"
              ? { icon: "calendar", title: "Application sent", message: "The coordinators have it now. You will get a notification when they decide. You can add people to the team while you wait.", ms: 6500 }
              : { icon: "calendar", title: "Created", message: "You can post events from inside it now.", ms: 4000 });
          setCreating(null);
          if (r.id) nav(`/app/campus/clubs/${r.id}`);
        }} />
      </section>
    );
  }

  return (
    <section className="clubs" aria-label="Clubs">
      <div className="toolbar">
        <p className="muted">Find your people, or start something.</p>
        <span className="toolbar-actions">
          <button type="button" className="link-btn" onClick={() => setCreating("circle")}>Start a circle</button>
          <button type="button" className="btn sm primary" onClick={() => setCreating("club")}>{reviewer ? "Set up a club" : "Start a club"}</button>
        </span>
      </div>

      {mine.length > 0 && (
        <div className="rows-block">
          <h2>Yours</h2>
          <ul className="club-rows">{mine.map((o) => <ClubRow key={o.id} o={o} />)}</ul>
        </div>
      )}
      <div className="rows-block">
        <h2>Clubs and offices</h2>
        {clubs.length === 0
          ? <p className="rows-empty">{mine.length ? "No other clubs yet." : "No clubs yet. Start the first one, and once a coordinator approves it you can post its events to the whole campus."}</p>
          : <ul className="club-rows">{clubs.map((o) => <ClubRow key={o.id} o={o} />)}</ul>}
      </div>
      <div className="rows-block">
        <h2>Student circles</h2>
        {circles.length === 0
          ? <p className="rows-empty">Circles are casual groups anyone can start and join, like a study group or a weekly run. Nobody has started one yet.</p>
          : <ul className="club-rows">{circles.map((o) => <ClubRow key={o.id} o={o} />)}</ul>}
      </div>
    </section>
  );
}

export { EventBadge } from "../components/EventCard";
