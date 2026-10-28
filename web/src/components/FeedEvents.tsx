import { Link } from "react-router-dom";
import { Megaphone } from "lucide-react";
import { isOpen, useCampusEvents } from "../lib/campusEvents";
import EventCard from "./EventCard";

const WEEK = 7 * 24 * 3600_000;

/** Up to two coming campus events, as cards between posts in the timeline. They are the same event cards as on the Campus page (labelled Official or Student event), so they are not mistaken for a post or a private hangout. */
export default function FeedEvents() {
  const { events, canReview } = useCampusEvents();
  const now = new Date();
  const next = events.filter((e) => !e.canceled && e.status === "published" && isOpen(e, now) && new Date(e.startsAt).getTime() - now.getTime() < WEEK).slice(0, 2);
  if (next.length === 0) return null;
  return (
    <section className="feed-events" aria-label="Happening on campus">
      <p className="feed-events-h"><Megaphone size={14} aria-hidden="true" /> Happening on campus <Link to="/app/campus">All events</Link></p>
      <ul className="ev-list">{next.map((e) => <EventCard key={e.id} e={e} reviewer={canReview} />)}</ul>
    </section>
  );
}

