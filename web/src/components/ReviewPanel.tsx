import { useState } from "react";
import { BadgeCheck, Check, Clock, Flag, Pause, Play, ShieldCheck, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { eventActions, useCampusEvents } from "../lib/campusEvents";
import { orgActions, useCampusOrgs } from "../lib/campusOrgs";
import { notice } from "../lib/notice";
import RichText from "./RichText";
import { eventWhen } from "./EventCard";
import ApplicationsBoard from "./ApplicationsBoard";

/** For coordinators and staff: what is waiting for a decision (new clubs, new events from clubs that are not trusted yet), the events people have reported,
 *  and the list of clubs with pause and trust switches. */
export default function ReviewPanel() {
  const { pending, reported } = useCampusEvents();
  const { orgs } = useCampusOrgs();
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  return (
    <div className="review" role="region" aria-label="Review">
      <ApplicationsBoard />

      {pending.length > 0 && (
        <section className="htools-block" aria-label="Events waiting for approval">
          <h3><Clock size={15} aria-hidden="true" /> Events waiting for approval <span className="rem-count">{pending.length}</span></h3>
          <ul>
            {pending.map((e) => (
              <li key={e.id}>
                <div className="htools-main">
                  <strong><RichText text={e.title} /></strong>
                  <span className="muted">{e.host} · {eventWhen(e)}{e.place ? ` · ${e.place}` : ""}</span>
                  {e.description && <span className="muted"><RichText text={e.description} /></span>}
                </div>
                {declining === `e-${e.id}` ? (
                  <form className="htools-row" onSubmit={(ev) => { ev.preventDefault(); void eventActions.decline(e.id, reason); setDeclining(null); setReason(""); notice.show({ icon: "calendar", title: "Event declined", message: "The host has been told.", ms: 3500 }); }}>
                    <input aria-label="Reason (optional)" autoFocus value={reason} maxLength={200} placeholder="Reason, so they can fix it (optional)" onChange={(x) => setReason(x.target.value)} />
                    <button className="btn danger">Decline</button><button type="button" className="btn" onClick={() => setDeclining(null)}>Back</button>
                  </form>
                ) : (
                  <div className="htools-row">
                    <button type="button" className="btn primary" onClick={() => { void eventActions.approve(e.id); notice.show({ icon: "calendar", title: "Event approved", message: "It now shows to everyone on campus.", ms: 3500 }); }}><Check size={15} aria-hidden="true" /> Approve</button>
                    <button type="button" className="btn" onClick={() => { setDeclining(`e-${e.id}`); setReason(""); }}>Decline</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {reported.length > 0 && (
        <section className="htools-block" aria-label="Reported events">
          <h3><Flag size={14} aria-hidden="true" /> Reported events <span className="rem-count">{reported.length}</span></h3>
          <ul>
            {reported.map(({ event, reasons }) => (
              <li key={event.id}>
                <div className="htools-main"><strong><RichText text={event.title} /></strong><span className="muted">{event.host}</span>{reasons.length > 0 && <span className="htools-why">“{reasons.slice(0, 2).join("”, “")}”</span>}</div>
                <div className="htools-row">
                  <button type="button" className="btn danger" onClick={() => { void eventActions.setRemoved(event.id, true); notice.show({ icon: "calendar", title: "Event removed", message: "It is hidden from students. You can bring it back from the Events list.", ms: 4000 }); }}>Remove event</button>
                  <button type="button" className="btn" onClick={() => void eventActions.dismissReports(event.id)}>It is fine</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="htools-block" aria-label="All clubs and offices">
        <h3><ShieldCheck size={15} aria-hidden="true" /> Clubs and offices</h3>
        {orgs.filter((o) => o.status !== "pending" || o.mine).length === 0 && <p className="muted">None yet.</p>}
        <ul>
          {orgs.filter((o) => o.status !== "pending" || o.mine).map((o) => (
            <li key={o.id} className="htools-org">
              <div className="htools-main">
                <div className="htools-title">
                  <Link to={`/app/campus/clubs/${o.id}`}><strong><RichText text={o.name} /></strong></Link>
                  <span className={"ebadge " + (o.kind === "official" ? "official" : "student")}>{o.kind === "official" ? <><BadgeCheck size={12} aria-hidden="true" /> Official</> : <><UserRound size={12} aria-hidden="true" /> Student club</>}</span>
                  {o.status !== "active" && <span className={"ebadge " + (o.status === "paused" ? "no" : "wait")}>{o.status === "paused" ? "Paused" : o.status === "pending" ? "Waiting" : "Declined"}</span>}
                </div>
                <span className="htools-members">{o.members.length} {o.members.length === 1 ? "officer" : "officers"}{o.kind === "student" ? (o.trusted ? " · events go live without review" : " · each new event waits for review") : " · events go live at once"}</span>
              </div>
              <div className="htools-row">
                {o.kind === "student" && o.status === "active" && (
                  <button type="button" className="btn" aria-pressed={o.trusted} onClick={() => void orgActions.setTrusted(o.id, !o.trusted)}><ShieldCheck size={14} aria-hidden="true" /> {o.trusted ? "Stop trusting" : "Trust this club"}</button>
                )}
                {o.status === "active" && <button type="button" className="btn" onClick={() => void orgActions.setPaused(o.id, true)}><Pause size={14} aria-hidden="true" /> Pause</button>}
                {o.status === "paused" && <button type="button" className="btn" onClick={() => void orgActions.setPaused(o.id, false)}><Play size={14} aria-hidden="true" /> Resume</button>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
