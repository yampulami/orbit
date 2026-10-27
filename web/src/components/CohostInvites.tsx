import { Check, Handshake, X } from "lucide-react";
import { eventActions, useCampusEvents } from "../lib/campusEvents";
import { eventWhen } from "./EventCard";
import { notice } from "../lib/notice";
import RichText from "./RichText";

/** Invitations for a club you help run: another club asks yours to co-host an event. Say yes and the event shows under your club too. */
export default function CohostInvites({ orgId }: { orgId?: string }) {
  const { invites } = useCampusEvents();
  const mine = orgId ? invites.filter((i) => i.org.id === orgId) : invites;
  if (mine.length === 0) return null;
  return (
    <section className="cohost-invites" aria-label="Co-host invitations">
      <h3><Handshake size={15} aria-hidden="true" /> Co-host invitations <span className="rem-count">{mine.length}</span></h3>
      <ul>
        {mine.map(({ event, org }) => (
          <li key={event.id + org.id}>
            <div className="htools-main">
              <strong><RichText text={event.title} /></strong>
              <span className="muted">{event.host} asks {org.name} to co-host · {eventWhen(event)}{event.place ? ` · ${event.place}` : ""}</span>
            </div>
            <div className="htools-row">
              <button type="button" className="btn primary" onClick={() => { void eventActions.answerCohost(event.id, org.id, true); notice.show({ icon: "calendar", title: "You are co-hosting", message: `${event.title} now shows under ${org.name} too.`, ms: 4000 }); }}><Check size={15} aria-hidden="true" /> Co-host</button>
              <button type="button" className="btn" onClick={() => void eventActions.answerCohost(event.id, org.id, false)}><X size={15} aria-hidden="true" /> Decline</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
