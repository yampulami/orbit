import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BadgeCheck, CalendarDays, ChevronDown, Compass, Info, Plus, ShieldCheck, UserRound, Users } from "lucide-react";
import { isOpen, setDemoRole, useCampusEvents, type Role } from "../lib/campusEvents";
import { orgHue, useCampusOrgs, type Org } from "../lib/campusOrgs";
import { dayLabel } from "../lib/look";
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

type Tab = "events" | "clubs";
type View = "discover" | "review";

/** Campus: your clubs down a rail on the left, like servers, and Discover beside it: the events and clubs open to everyone on campus. A club is set up first
 *  (a coordinator approves it), and its events are posted from inside the club. Coordinators also get Review on the rail. */
export default function Campus() {
  const nav = useNavigate();
  const { events, pending, reported, isHost, role, canReview: reviewer, hostLabel, ready } = useCampusEvents();
  const { orgs, mine } = useCampusOrgs();
  const [tab, setTab] = useState<Tab>("events");
  const [view, setView] = useState<View>("discover");
  const [menu, setMenu] = useState(false);
  const [creating, setCreating] = useState<"club" | "circle" | null>(null);
  const waitingOrgs = orgs.filter((o) => o.status === "pending");
  const reviewCount = reviewer ? pending.length + reported.length + waitingOrgs.length : 0;
  const current: View = view === "review" && !reviewer ? "discover" : view;
  const go = (v: View) => { setCreating(null); setView(v); };

  return (
    <div className="page campus">
      <div className="campus-shell">
        <nav className="crail" aria-label="Your clubs">
          <button type="button" className="rail-ico rail-home" aria-label="Discover" aria-current={current === "discover" && !creating ? "page" : undefined} data-tip="Discover" onClick={() => go("discover")}><Compass size={22} aria-hidden="true" /></button>
          {reviewer && (
            <button type="button" className="rail-ico rail-home" aria-label="Review" aria-current={current === "review" && !creating ? "page" : undefined} data-tip="Review" onClick={() => go("review")}>
              <ShieldCheck size={22} aria-hidden="true" />{reviewCount > 0 && <span className="rail-badge">{reviewCount}</span>}
            </button>
          )}
          <span className="rail-sep" aria-hidden="true" />
          {mine.map((o) => (
            <Link key={o.id} to={`/app/campus/clubs/${o.id}`} className="rail-ico" style={{ ["--h" as string]: orgHue(o) }} aria-label={o.name} data-tip={o.name}>
              {o.icon || o.name.slice(0, 1).toUpperCase()}
              {o.status === "pending" && <span className="rail-badge wait" aria-hidden="true" />}
            </Link>
          ))}
          <span className="rail-add">
            <button type="button" className="rail-ico rail-plus" aria-label="Start a club or circle" aria-expanded={menu} data-tip="Start something" onClick={() => setMenu((v) => !v)}><Plus size={22} aria-hidden="true" /></button>
            {menu && (
              <span className="rail-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setMenu(false); setCreating("club"); }}>{reviewer ? "Set up a club" : "Start a club"}</button>
                <button type="button" role="menuitem" onClick={() => { setMenu(false); setCreating("circle"); }}>Start a circle</button>
              </span>
            )}
          </span>
        </nav>

        <div className="campus-main">
          {creating ? (
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
          ) : current === "review" && reviewer ? (
            <>
              <h1 className="campus-title">Review</h1>
              <ReviewPanel />
            </>
          ) : (
            <>
              <header className="campus-head">
                <h1 className="campus-title">Discover</h1>
                <div className="segment campus-seg" role="tablist" aria-label="Discover">
                  <button type="button" role="tab" aria-selected={tab === "events"} onClick={() => setTab("events")}>Events</button>
                  <button type="button" role="tab" aria-selected={tab === "clubs"} onClick={() => setTab("clubs")}>Clubs</button>
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
              {tab === "events" && <EventsView events={events} ready={ready} isHost={isHost} role={role} hostLabel={hostLabel} reviewer={reviewer} />}
              {tab === "clubs" && <ClubsView mine={mine} all={orgs} />}
            </>
          )}
        </div>
      </div>
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
      <Link className="club-row" style={{ ["--h" as string]: orgHue(o) }} to={`/app/campus/clubs/${o.id}`}>
        <span className="club-mark" aria-hidden="true">{o.icon || o.name.slice(0, 1).toUpperCase()}</span>
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

/** Clubs to find. The ones you are in are on the rail, so they are not repeated here. */
function ClubsView({ mine, all }: { mine: Org[]; all: Org[] }) {
  const mineIds = new Set(mine.map((o) => o.id));
  const others = all.filter((o) => !mineIds.has(o.id) && o.status === "active");
  const clubs = others.filter((o) => o.kind !== "circle");
  const circles = others.filter((o) => o.kind === "circle");

  return (
    <section className="clubs" aria-label="Clubs">
      {clubs.length > 0 && (
        <div className="rows-block">
          <h2>Clubs and offices</h2>
          <ul className="club-rows">{clubs.map((o) => <ClubRow key={o.id} o={o} />)}</ul>
        </div>
      )}
      {circles.length > 0 && (
        <div className="rows-block">
          <h2>Student circles</h2>
          <ul className="club-rows">{circles.map((o) => <ClubRow key={o.id} o={o} />)}</ul>
        </div>
      )}
      {others.length === 0 && <p className="rows-empty">{mine.length ? "You are in everything there is. Tap + on the left to start something." : "Nothing here yet. Tap + on the left to start the first club or circle."}</p>}
    </section>
  );
}

export { EventBadge } from "../components/EventCard";
