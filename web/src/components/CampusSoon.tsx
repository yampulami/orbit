import { Link } from "react-router-dom";
import { eventActions, hostedBy, isOpen, useCampusEvents, type CampusEvent } from "../lib/campusEvents";
import { cheer, goingLine } from "../lib/cheer";
import { clock, dayWord } from "../lib/dayWords";
import { undo } from "../lib/undo";
import { useIsPhone } from "../lib/phone";

const WEEK = 7 * 24 * 3600_000;
const office = (e: CampusEvent) => e.kind === "official" || !!e.orgId;
const hostLine = (e: CampusEvent) => hostedBy(e) + (office(e) ? " (campus office)" : "");

function Row({ e, host }: { e: CampusEvent; host: boolean }) {
  const s = new Date(e.startsAt);
  const going = e.mine === "going";
  const toggle = () => {
    if (!going) { cheer.show(goingLine(0)); eventActions.respond(e.id, "going"); return; }
    eventActions.respond(e.id, null);
    undo.show(`You’re no longer going to “${e.title}”`, { onUndo: () => eventActions.respond(e.id, "going"), commit: () => {} });
  };
  return (
    <li className="cs-row">
      <div className="cs-rail"><b>{dayWord(s)}</b><span>{clock(s)}</span>{e.endsAt && <small>to {clock(new Date(e.endsAt))}</small>}</div>
      <div className="cs-main">
        <h3>{e.title}</h3>
        <p>{[e.place, host ? hostLine(e) : "", e.going > 0 ? `${e.going} going` : ""].filter(Boolean).join(" · ")}</p>
      </div>
      {e.mineHost
        ? <span className="cs-host">You’re hosting</span>
        : <button type="button" className="btn" aria-pressed={going} aria-label={`${going ? "Going" : "I’m going"} to ${e.title}`} onClick={toggle}>{going ? "Going" : "I’m going"}</button>}
    </li>
  );
}

/** The next few campus events, in time order and apart from the posts. On a phone only the first shows, with a link to the rest. */
export default function CampusSoon() {
  const { events } = useCampusEvents();
  const phone = useIsPhone();
  const now = new Date();
  const next = events
    .filter((e) => !e.canceled && e.status === "published" && isOpen(e, now) && new Date(e.startsAt).getTime() - now.getTime() < WEEK)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 3);
  if (next.length === 0) return null;
  const shown = phone ? next.slice(0, 1) : next;
  // When everyone on the list has the same host, say it once under the heading instead of on every row.
  const sameHost = next.every((e) => hostLine(e) === hostLine(next[0]));
  return (
    <section className="cs" aria-label="Campus events">
      <header><h2>On campus soon</h2><Link to="/app/campus">{phone && next.length > 1 ? `${next.length - 1} more · All events` : "All events"}</Link></header>
      {sameHost && <p className="cs-by">Hosted by {hostLine(next[0])}. “I’m going” adds you to the public going count.</p>}
      {!sameHost && <p className="cs-by">“I’m going” adds you to the public going count.</p>}
      <ul>{shown.map((e) => <Row key={e.id} e={e} host={!sameHost} />)}</ul>
    </section>
  );
}
