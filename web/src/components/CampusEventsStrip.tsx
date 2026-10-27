import { Link } from "react-router-dom";
import { Megaphone } from "lucide-react";
import { EventBadge } from "./CampusEvents";
import { isOpen, useCampusEvents } from "../lib/campusEvents";
import RichText from "./RichText";

/** A short "Happening on campus" list for Home: the next couple of events, with a way into Plans for the rest. Shows nothing when there are none. */
export default function CampusEventsStrip() {
  const { events } = useCampusEvents();
  const next = events.filter((e) => !e.canceled && e.status === "published" && isOpen(e, new Date())).slice(0, 2);
  if (next.length === 0) return null;
  return (
    <section className="up cstrip" aria-label="Happening on campus">
      <header><h3><Megaphone size={15} aria-hidden="true" /> Happening on campus</h3></header>
      <ul>
        {next.map((e) => (
          <li key={e.id}>
            <Link className="up-main" to="/app/plans">
              <span className="up-text"><EventBadge e={e} /><strong><RichText text={e.title} /></strong><span className="up-sub">{new Date(e.startsAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}, {new Date(e.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · {e.host}</span></span>
            </Link>
          </li>
        ))}
      </ul>
      <Link className="up-more" to="/app/plans">See all campus events</Link>
    </section>
  );
}
