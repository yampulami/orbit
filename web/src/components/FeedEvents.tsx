import { Link } from "react-router-dom";
import { Check, MapPin, Megaphone, Star } from "lucide-react";
import { eventActions, isOpen, useCampusEvents } from "../lib/campusEvents";
import { EventBadge, eventWhen } from "./EventCard";
import VerifiedBadge from "./VerifiedBadge";
import RichText from "./RichText";
import { cheer, goingLine } from "../lib/cheer";

const WEEK = 7 * 24 * 3600_000;

/** Up to two coming campus events, as cards between posts in the timeline. They are labelled (Official or Student event) so they are not mistaken for a post or a private hangout. */
export default function FeedEvents() {
  const { events } = useCampusEvents();
  const now = new Date();
  const next = events.filter((e) => !e.canceled && e.status === "published" && isOpen(e, now) && new Date(e.startsAt).getTime() - now.getTime() < WEEK).slice(0, 2);
  if (next.length === 0) return null;
  return (
    <section className="feed-events" aria-label="Happening on campus">
      <p className="feed-events-h"><Megaphone size={14} aria-hidden="true" /> Happening on campus <Link to="/app/campus">All events</Link></p>
      {next.map((e) => {
        const d = new Date(e.startsAt);
        return (
          <article key={e.id} className={"card tile feed-event " + e.kind}>
            <div className="cevent-date" aria-hidden="true"><b>{d.getDate()}</b><span>{d.toLocaleDateString(undefined, { month: "short" })}</span></div>
            <div className="cevent-body">
              <EventBadge e={e} />
              <strong><RichText text={e.title} /></strong>
              <p className="cevent-meta">{eventWhen(e)} · by {e.host}<VerifiedBadge label={e.kind === "official" ? "Verified: official campus office" : "Verified: club approved by a coordinator"} />{e.place && <><span aria-hidden="true"> · </span><MapPin size={12} aria-hidden="true" /> {e.place}</>}</p>
              <div className="cevent-actions">
                <div className="cal-hbtns" role="group" aria-label={`Your answer for ${e.title}`}>
                  <button type="button" data-a="yes" aria-pressed={e.mine === "going"} onClick={() => { if (e.mine !== "going") cheer.show(goingLine(e.going)); eventActions.respond(e.id, e.mine === "going" ? null : "going"); }}><Check size={14} aria-hidden="true" /> Going</button>
                  <button type="button" aria-pressed={e.mine === "interested"} onClick={() => eventActions.respond(e.id, e.mine === "interested" ? null : "interested")}><Star size={14} aria-hidden="true" /> Interested</button>
                </div>
                <span className="cevent-count">{e.going} going</span>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
