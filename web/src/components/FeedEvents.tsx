import { Link } from "react-router-dom";
import { CalendarDays, Check, Clock, MapPin, Star } from "lucide-react";
import { eventActions, hostedBy, isOpen, useCampusEvents, type CampusEvent } from "../lib/campusEvents";
import { countdown } from "../lib/look";
import { cheer, goingLine } from "../lib/cheer";
import { eventWhen } from "./EventCard";
import RichText from "./RichText";
import VerifiedBadge from "./VerifiedBadge";

const WEEK = 7 * 24 * 3600_000;

/** One campus event, shaped like the posts around it: who is hosting and when, a title, where and when, and answers. The fuller card is on the Campus page. */
function FeedEvent({ e }: { e: CampusEvent }) {
  const d = new Date(e.startsAt);
  const when = countdown(e.startsAt, e.endsAt, new Date());
  const going = e.mine === "going", interested = e.mine === "interested";
  const verified = e.kind === "official" || !!e.orgId;
  return (
    <article className="card post tile event-post" aria-label={`Event: ${e.title}`}>
      <div className="meta">
        <span className="who">
          <span className="ev-date" aria-hidden="true"><i>{d.toLocaleDateString(undefined, { month: "short" })}</i><b>{d.getDate()}</b></span>
          <span><strong style={{ color: "var(--ink)" }}>{hostedBy(e)}</strong>{verified && <VerifiedBadge label={e.kind === "official" ? "Verified: official campus office" : "Verified: club approved by a coordinator"} />}{when && when.tone !== "past" ? ` · ${when.text}` : ""}</span>
        </span>
        <span className="meta-end"><span className="chip ev-chip"><CalendarDays size={12} aria-hidden="true" /> Event</span></span>
      </div>
      <h3>{e.title}</h3>
      <p className="ev-line"><span><Clock size={13} aria-hidden="true" /> {eventWhen(e)}</span>{e.place && <span><MapPin size={13} aria-hidden="true" /> {e.place}</span>}</p>
      {e.description && <p className="body ev-desc2"><RichText text={e.description} /></p>}
      <div className="foot">
        {e.mineHost ? (
          <span className="ev-hosting"><Check size={13} aria-hidden="true" /> You are hosting</span>
        ) : (
          <div className="ev-act" role="group" aria-label={`Your answer for ${e.title}`}>
            <button type="button" className="ev-btn" data-tone="going" aria-pressed={going} onClick={() => { if (!going) cheer.show(goingLine(0)); eventActions.respond(e.id, going ? null : "going"); }}><Check size={14} aria-hidden="true" /> {going ? "Going" : "I'm going"}</button>
            <button type="button" className="ev-btn" data-tone="maybe" aria-pressed={interested} onClick={() => eventActions.respond(e.id, interested ? null : "interested")}><Star size={14} aria-hidden="true" /> Interested</button>
          </div>
        )}
        <span className="ev-count">{e.going} going{e.interested > 0 ? ` · ${e.interested} interested` : ""}</span>
        <Link to="/app/campus" className="link-btn ev-all">All events</Link>
      </div>
    </article>
  );
}

/** Up to two coming campus events, in the timeline between posts, written the way posts are. */
export default function FeedEvents() {
  const { events } = useCampusEvents();
  const now = new Date();
  const next = events.filter((e) => !e.canceled && e.status === "published" && isOpen(e, now) && new Date(e.startsAt).getTime() - now.getTime() < WEEK).slice(0, 2);
  if (next.length === 0) return null;
  return <>{next.map((e) => <FeedEvent key={e.id} e={e} />)}</>;
}
