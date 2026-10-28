import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, ChevronDown, Clock, ClipboardList, Hash, Info, Lock, Megaphone, Orbit, Plus, Users, X } from "lucide-react";
import { isOpen, useCampusEvents } from "../lib/campusEvents";
import { canHostEvents, eventsNeedApproval, useCampusOrgs } from "../lib/campusOrgs";
import { useClubFeed, lastPostAt } from "../lib/clubFeed";
import { useClubChat } from "../lib/clubChat";
import { useClubPods } from "../lib/clubPods";
import { useClubTasks, isOverdue } from "../lib/clubTasks";
import { useClubPresence } from "../lib/clubPresence";
import { useAuth } from "../lib/auth";
import { activityOf } from "../lib/activity";
import { dayLabel, hueFor } from "../lib/look";
import EventCard from "../components/EventCard";
import EventForm from "../components/EventForm";
import EmptyState from "../components/EmptyState";
import RichText from "../components/RichText";
import VerifiedBadge from "../components/VerifiedBadge";
import { JoinButton } from "../components/JoinPanel";
import ClubFeed from "../components/ClubFeed";
import ClubChat from "../components/ClubChat";
import PodsPanel from "../components/PodsPanel";
import ClubDashboard from "../components/ClubDashboard";
import ClubMembers from "../components/ClubMembers";
import ClubInfoSheet from "../components/ClubInfoSheet";
import MyTasks from "../components/MyTasks";
import CohostInvites from "../components/CohostInvites";

type View = "feed" | "chat" | "dashboard" | "events" | "pods";
const EVENTS_NOTE = "Every event this club posts shows up here, with RSVP and check-in.";

/** One club, office or circle, laid out like a server: channels down the left, the conversation or feed in the middle, members on the right. The club's own
 *  colour tints the header and the active channel; the (i) button opens everything about it. On a phone the two side panels are drawers (swipe, or tap). */
export default function Club() {
  const { id } = useParams();
  const { session } = useAuth();
  const { orgs, ready } = useCampusOrgs();
  const { events, canReview: reviewer } = useCampusEvents();
  const [view, setView] = useState<View>("feed");
  const [info, setInfo] = useState(false);
  const [people, setPeople] = useState(false);
  const [chans, setChans] = useState(false);
  const [posting, setPosting] = useState(false);
  const [chanId, setChanId] = useState("");
  const [making, setMaking] = useState(false);
  const [past, setPast] = useState(false);
  const org = orgs.find((o) => o.id === id);
  const inside = !!org && org.status === "active" && (org.myJoin === "officer" || org.myJoin === "member");
  const feed = useClubFeed(org?.id ?? "", !!org && (org.status === "active" || org.mine || reviewer));
  const pods = useClubPods(org?.id ?? "", inside);
  const [chatFocus, setChatFocus] = useState("");
  const tasks = useClubTasks(org?.id ?? "", inside);
  const chat = useClubChat(org?.id ?? "", inside);
  const here = useClubPresence(org?.id ?? "", session?.user.id, !!org && org.status === "active");
  const touch = useRef<{ x: number; y: number } | null>(null);

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
  const count = org.members.length + org.clubMembers.filter((m) => !org.members.some((t) => t.id === m.id)).length;
  const requests = canMembers ? org.requests.length : 0;
  const seesApplication = (reviewer || org.mine) && (org.status !== "active" || !!org.application.advisorName);
  const overdue = tasks.tasks.some((t) => isOverdue(t, now));
  const cur: View = view === "dashboard" && !org.mine ? "feed" : view === "events" && circle ? "feed" : view;
  const pick = (v: View) => { setView(v); setChans(false); };

  // The chat's channels sit in the sidebar with the rest, as in a server: Feed and Events first, then the channels, then the pods.
  const myPods = new Set(pods.pods.filter((p) => p.mine).map((p) => p.id));
  const chatChans = inside ? chat.channels.filter((c) => (!c.teamOnly || org.mine) && (!c.podId || org.mine || myPods.has(c.podId))) : [];
  const activeChan = chatChans.find((c) => c.id === chanId) ?? chatChans[0];
  const canChannels = org.owner || org.myPerms.includes("channels");
  const label = cur === "chat" ? `# ${activeChan?.name ?? "chat"}` : cur === "events" ? "Events" : cur === "pods" ? "Pods" : cur === "dashboard" ? "Manage" : "Feed";
  const openChan = (id: string) => { setChanId(id); pick("chat"); };

  // On a phone, swipe right for the channels and left for the members.
  const onTouchStart = (e: React.TouchEvent) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current; touch.current = null;
    if (!s) return;
    const t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 45) return;
    if (dx > 0) { if (people) setPeople(false); else setChans(true); }
    else { if (chans) setChans(false); else setPeople(true); }
  };

  return (
    <div className="page club-page club-wide" style={{ ["--h" as string]: hueFor(org.name) }}>
      <header className="club-bar">
        <Link className="club-back" to="/app/campus" aria-label="Back to Campus"><ArrowLeft size={18} aria-hidden="true" /></Link>
        <span className="club-planet sm" aria-hidden="true">{org.name.slice(0, 1).toUpperCase()}</span>
        <div className="club-bar-text">
          <h1><RichText text={org.name} />{org.status === "active" && !circle && <VerifiedBadge label={org.kind === "official" ? "Verified: official campus office" : "Verified: approved by a coordinator"} />}</h1>
          <span className="club-bar-sub">
            {org.status === "active" && <span className={"act " + act.level} title={act.line || undefined}><i aria-hidden="true" />{act.label}</span>}
            {org.status === "pending" && <><Clock size={12} aria-hidden="true" /> Waiting for approval</>}
            {org.status === "paused" && "Paused"}
            {org.status === "rejected" && <><X size={12} aria-hidden="true" /> Not approved</>}
            {org.status === "active" && <span className="muted"> · {count} {count === 1 ? "person" : "people"}</span>}
          </span>
        </div>
        <JoinButton org={org} />
        {canPost && <button type="button" className="btn sm primary club-post" onClick={() => { setView("events"); setPosting(true); }}><Plus size={15} aria-hidden="true" /> <span>Post</span></button>}
        <button type="button" className="ac-icon" aria-label={`About ${org.name}`} title="About" onClick={() => setInfo(true)}><Info size={19} aria-hidden="true" /></button>
        <button type="button" className="ac-icon club-ppl" aria-label="Members" aria-pressed={people} title="Members" onClick={() => setPeople((v) => !v)}><Users size={19} aria-hidden="true" />{requests > 0 && <span className="rail-badge">{requests}</span>}</button>
      </header>

      {org.status === "pending" && <p className="cevent-note" role="status">A coordinator needs to approve this club before it can post events. You can add officers while you wait.</p>}
      {org.status === "rejected" && <p className="cevent-note" role="status">Not approved{org.note ? `: ${org.note}` : "."}</p>}
      {org.status === "paused" && <p className="cevent-note" role="status">A coordinator paused this club. It cannot post new events for now.</p>}

      <div className="club-shell" data-members={people ? "" : undefined} data-chans={chans ? "" : undefined} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <nav className="club-chans" aria-label="Channels">
          <ul>
            <li><button type="button" className="chan" aria-current={cur === "feed" ? "page" : undefined} onClick={() => pick("feed")}><Megaphone size={16} aria-hidden="true" /><span>Feed</span></button></li>
            {!circle && <li><button type="button" className="chan" aria-current={cur === "events" ? "page" : undefined} onClick={() => pick("events")}><CalendarDays size={16} aria-hidden="true" /><span>Events</span>{upcoming.length > 0 && <span className="rem-count">{upcoming.length}</span>}</button></li>}
          </ul>
          {chatChans.some((c) => !c.podId) && <h3 className="chan-label">Channels</h3>}
          <ul>
            {chatChans.filter((c) => !c.podId).map((c) => (
              <li key={c.id}><button type="button" className="chan" aria-current={cur === "chat" && activeChan?.id === c.id ? "page" : undefined} onClick={() => openChan(c.id)}>
                {c.teamOnly ? <Lock size={15} aria-hidden="true" /> : <Hash size={15} aria-hidden="true" />}<span>{c.name}</span>{c.unread > 0 && !(cur === "chat" && activeChan?.id === c.id) && <span className="rem-count">{c.unread > 9 ? "9+" : c.unread}</span>}
              </button></li>
            ))}
            {canChannels && inside && <li><button type="button" className="chan add" onClick={() => { setMaking(true); pick("chat"); }}><Plus size={15} aria-hidden="true" /><span>New channel</span></button></li>}
          </ul>
          {chatChans.some((c) => c.podId) && <h3 className="chan-label">Pod chats</h3>}
          <ul>
            {chatChans.filter((c) => c.podId).map((c) => (
              <li key={c.id}><button type="button" className="chan" aria-current={cur === "chat" && activeChan?.id === c.id ? "page" : undefined} onClick={() => openChan(c.id)}>
                <Hash size={15} aria-hidden="true" /><span>{c.name}</span>{c.unread > 0 && !(cur === "chat" && activeChan?.id === c.id) && <span className="rem-count">{c.unread > 9 ? "9+" : c.unread}</span>}
              </button></li>
            ))}
          </ul>
          <h3 className="chan-label">Club</h3>
          <ul>
            {org.status === "active" && <li><button type="button" className="chan" aria-current={cur === "pods" ? "page" : undefined} onClick={() => pick("pods")}><Orbit size={16} aria-hidden="true" /><span>Pods</span></button></li>}
            {org.mine && org.status === "active" && <li><button type="button" className="chan" aria-current={cur === "dashboard" ? "page" : undefined} onClick={() => pick("dashboard")}><ClipboardList size={16} aria-hidden="true" /><span>Manage</span>{overdue && <span className="rem-count" aria-label="Overdue tasks">!</span>}</button></li>}
          </ul>
        </nav>
        <button type="button" className="club-scrim" aria-label="Close panels" tabIndex={-1} onClick={() => { setChans(false); setPeople(false); }} />

        <main className="club-view">
          <button type="button" className="club-chan-title" aria-haspopup="true" onClick={() => setChans(true)}>{label}<ChevronDown size={15} aria-hidden="true" /></button>

          {cur === "feed" && <><MyTasks board={tasks} /><ClubFeed org={org} reviewer={reviewer} feed={feed} /></>}
          {cur === "chat" && <ClubChat org={org} reviewer={reviewer} chat={chat} pods={pods.pods} focusId={chatFocus} channelId={activeChan?.id ?? ""} creating={making} onPick={setChanId} onCloseCreate={() => setMaking(false)} />}
          {cur === "dashboard" && org.mine && <ClubDashboard org={org} events={events} board={tasks} reviewer={reviewer} go={(t) => (t === "people" ? setPeople(true) : pick("events"))} />}
          {cur === "pods" && org.status === "active" && <PodsPanel org={org} pods={pods} openChat={(pid) => { void chat.reload(); setChatFocus(pid); openChan(pid); }} />}

          {cur === "events" && !circle && (
            <section className="club-section" aria-label="Events">
              <header className="chan-head"><h2><CalendarDays size={16} aria-hidden="true" /> events</h2><p className="muted">{EVENTS_NOTE}</p></header>
              {canPost && waits && !posting && <p className="muted">New events from this club wait for a coordinator before everyone sees them.</p>}
              {posting && canPost && <EventForm org={org} onDone={() => setPosting(false)} />}
              {!posting && <CohostInvites orgId={org.id} />}
              {!(posting && canPost) && (upcoming.length === 0
                ? <EmptyState icon={CalendarDays} title="Nothing coming up">{canPost ? "Post the first event. It shows to the whole campus once it is live." : org.status === "active" ? "When this club posts one, it shows here." : "Events can be posted once a coordinator approves the club."}</EmptyState>
                : (
                  <>
                    {next && <div className="club-next"><h2>Up next</h2><ul className="ev-list"><EventCard e={next} reviewer={reviewer} featured /></ul></div>}
                    {groups.map(([lbl, list]) => (
                      <div key={lbl} className="ev-day"><h3>{lbl}</h3><ul className="ev-list">{list.map((e) => <EventCard key={e.id} e={e} reviewer={reviewer} />)}</ul></div>
                    ))}
                  </>
                ))}
              {canPost && !posting && <button type="button" className="chan-compose" onClick={() => setPosting(true)}><Plus size={16} aria-hidden="true" /> Post an event to #events</button>}
              {gone.length > 0 && !(posting && canPost) && (
                <div className="ev-past">
                  <button type="button" className="link-btn" aria-expanded={past} onClick={() => setPast((v) => !v)}>{past ? "Hide" : "Show"} past and declined events ({gone.length})</button>
                  {past && <ul className="ev-list">{gone.slice().reverse().map((e) => <EventCard key={e.id} e={e} reviewer={reviewer} />)}</ul>}
                </div>
              )}
            </section>
          )}
        </main>

        {people && <ClubMembers org={org} here={here} canRoles={canRoles} canMembers={canMembers} onClose={() => setPeople(false)} />}
      </div>

      {info && <ClubInfoSheet org={org} reviewer={reviewer} canRoles={canRoles} seesApplication={seesApplication} onClose={() => setInfo(false)} />}
    </div>
  );
}
