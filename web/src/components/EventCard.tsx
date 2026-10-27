import { useState } from "react";
import { BadgeCheck, Check, Clock, Flag, MapPin, Star, UserRound, Users, X } from "lucide-react";
import { eventActions, type CampusEvent } from "../lib/campusEvents";
import { notice } from "../lib/notice";
import RichText from "./RichText";

export const eventWhen = (e: Pick<CampusEvent, "startsAt" | "endsAt">) => {
  const s = new Date(e.startsAt);
  const day = s.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const t = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${t(s)}${e.endsAt ? ` to ${t(new Date(e.endsAt))}` : ""}`;
};

/** The label that says what kind of event this is, so nobody mistakes it for a private hangout. */
export function EventBadge({ e }: { e: Pick<CampusEvent, "kind" | "status"> }) {
  if (e.status === "pending") return <span className="ebadge wait"><Clock size={12} aria-hidden="true" /> Waiting for approval</span>;
  if (e.status === "rejected") return <span className="ebadge no"><X size={12} aria-hidden="true" /> Not approved</span>;
  if (e.status === "removed") return <span className="ebadge no"><X size={12} aria-hidden="true" /> Removed</span>;
  return e.kind === "official"
    ? <span className="ebadge official"><BadgeCheck size={12} aria-hidden="true" /> Official campus event</span>
    : <span className="ebadge student"><UserRound size={12} aria-hidden="true" /> Student event</span>;
}

/** One campus event: what, when, where, who is going, and what you can do about it (answer, report, or as the host cancel; as a coordinator remove). */
export default function EventCard({ e, reviewer }: { e: CampusEvent; reviewer: boolean }) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [why, setWhy] = useState("");
  const [sure, setSure] = useState(false);
  const d = new Date(e.startsAt);
  const live = e.status === "published";

  return (
    <li className={"cevent " + e.kind + (e.canceled ? " canceled" : "") + (live ? "" : " waiting")}>
      <div className="cevent-date" aria-hidden="true"><b>{d.getDate()}</b><span>{d.toLocaleDateString(undefined, { month: "short" })}</span></div>
      <div className="cevent-body">
        <EventBadge e={e} />
        <div className="cevent-top">
          <strong><RichText text={e.title} /></strong>
          <span className="cevent-host">by {e.host}</span>
        </div>
        <p className="cevent-meta">{eventWhen(e)}{e.place && <><span aria-hidden="true"> · </span><MapPin size={12} aria-hidden="true" /> {e.place}</>}</p>
        {e.canceled && <p className="cevent-cancel" role="status">Cancelled</p>}
        {e.status === "pending" && <p className="cevent-note" role="status">A coordinator needs to approve this before other students can see it.</p>}
        {e.status === "rejected" && <p className="cevent-note" role="status">Not approved{e.note ? `: ${e.note}` : "."} You can post it again with changes.</p>}
        {e.status === "removed" && <p className="cevent-note" role="status">A coordinator removed this event, so students cannot see it.{reviewer ? "" : " Ask a coordinator if you think that was a mistake."}</p>}
        {e.status === "removed" && reviewer && <div className="cevent-actions"><button type="button" className="btn" onClick={() => void eventActions.setRemoved(e.id, false)}>Bring it back</button></div>}
        {e.description && (
          <p className={"cevent-desc" + (open ? " open" : "")}><RichText text={e.description} />{" "}
            {e.description.length > 110 && <button type="button" className="link-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? "Less" : "More"}</button>}
          </p>
        )}
        {live && (
          <div className="cevent-actions">
            <span className="cevent-count"><Users size={13} aria-hidden="true" /> {e.going} going{e.interested > 0 ? ` · ${e.interested} interested` : ""}</span>
            {!e.canceled && (
              <div className="cal-hbtns" role="group" aria-label={`Your answer for ${e.title}`}>
                <button type="button" data-a="yes" aria-pressed={e.mine === "going"} onClick={() => eventActions.respond(e.id, e.mine === "going" ? null : "going")}><Check size={14} aria-hidden="true" /> Going</button>
                <button type="button" aria-pressed={e.mine === "interested"} onClick={() => eventActions.respond(e.id, e.mine === "interested" ? null : "interested")}><Star size={14} aria-hidden="true" /> Interested</button>
              </div>
            )}
            {!e.mineHost && !e.canceled && (reporting
              ? <form className="cevent-report" onSubmit={async (ev) => { ev.preventDefault(); await eventActions.report(e.id, why); setReporting(false); setWhy(""); notice.show({ icon: "pin", title: "Thanks for telling us", message: "A coordinator will take a look.", ms: 4000 }); }}>
                  <input aria-label="What is wrong? (optional)" autoFocus value={why} maxLength={200} placeholder="What is wrong? (optional)" onChange={(x) => setWhy(x.target.value)} />
                  <button className="btn">Report</button><button type="button" className="btn" onClick={() => setReporting(false)}>Back</button>
                </form>
              : <button type="button" className="link-btn report-btn" onClick={() => { setReporting(true); setWhy(""); }}><Flag size={12} aria-hidden="true" /> Report</button>)}
            {reviewer && !e.mineHost && <button type="button" className="link-btn report-btn" onClick={() => { void eventActions.setRemoved(e.id, true); notice.show({ icon: "calendar", title: "Event removed", message: "It is hidden from students.", ms: 3500 }); }}>Remove</button>}
            {e.mineHost && !e.canceled && (sure
              ? <span className="cevent-sure"><button type="button" className="btn danger" onClick={() => { void eventActions.cancel(e.id); setSure(false); notice.show({ icon: "calendar", title: "Event cancelled", message: "People who said going or interested have been told.", ms: 4000 }); }}>Yes, cancel it</button><button type="button" className="btn" onClick={() => setSure(false)}>Keep it</button></span>
              : <button type="button" className="btn" onClick={() => setSure(true)}>Cancel event</button>)}
          </div>
        )}
      </div>
    </li>
  );
}
