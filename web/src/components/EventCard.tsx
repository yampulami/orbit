import { useRef, useState } from "react";
import { BadgeCheck, Check, Clock, Flag, Gamepad2, Hammer, MapPin, Mic, PartyPopper, QrCode, Star, Store, Trophy, UserRound, Users, Utensils, X } from "lucide-react";
import { eventActions, hostedBy, type CampusEvent } from "../lib/campusEvents";
import { countdown, eventFlavor, hueFor, type FlavorKey } from "../lib/look";
import { notice } from "../lib/notice";
import RichText from "./RichText";
import VerifiedBadge from "./VerifiedBadge";
import { cheer, goingLine } from "../lib/cheer";
import { checkinActions, checkinOpen, useMyCheckins } from "../lib/checkin";
import EventCheckin from "./EventCheckin";

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

const FLAVOR_ICON: Record<FlavorKey, typeof Hammer> = { workshop: Hammer, talk: Mic, social: PartyPopper, game: Gamepad2, meeting: Users, fair: Store, sport: Trophy, food: Utensils };

/** One campus event as a ticket: a date stub tinted by its club, how close it is, what it is, and answers that react when you tap them. */
export default function EventCard({ e, reviewer, featured = false }: { e: CampusEvent; reviewer: boolean; featured?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [why, setWhy] = useState("");
  const [sure, setSure] = useState(false);
  const [burst, setBurst] = useState(0);
  const [ci, setCi] = useState(false);
  const [runCi, setRunCi] = useState(false);
  const [code, setCode] = useState("");
  const [ciError, setCiError] = useState("");
  const checked = useMyCheckins().ids.has(e.id);
  const canCheckIn = e.status === "published" && !e.canceled && !e.manage && checkinOpen(e, new Date());
  const goRef = useRef<HTMLButtonElement>(null);
  const d = new Date(e.startsAt);
  const live = e.status === "published";
  const flavor = eventFlavor(e.title, e.description);
  const FlavorIcon = flavor ? FLAVOR_ICON[flavor.key] : null;
  const when = live && !e.canceled ? countdown(e.startsAt, e.endsAt, new Date()) : null;
  const hue = hueFor(e.host);
  const going = e.mine === "going";

  function toggleGoing() {
    if (!going) { setBurst((n) => n + 1); cheer.show(goingLine(burst)); }
    eventActions.respond(e.id, going ? null : "going");
  }

  return (
    <li className={"ev " + e.kind + (e.canceled ? " canceled" : "") + (live ? "" : " waiting") + (featured ? " featured" : "") + (going ? " is-going" : "")} style={{ ["--h" as string]: hue }}>
      <div className="ev-stub" aria-hidden="true">
        <span className="ev-mon">{d.toLocaleDateString(undefined, { month: "short" })}</span>
        <b>{d.getDate()}</b>
        <span className="ev-dow">{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
        {FlavorIcon && <FlavorIcon className="ev-ico" size={16} />}
      </div>
      <div className="ev-body">
        <div className="ev-tags">
          <EventBadge e={e} />
          {flavor && live && <span className="ev-flavor">{flavor.label}</span>}
          {checked && <span className="ev-checked"><Check size={11} aria-hidden="true" /> Checked in</span>}
          {when && when.tone !== "past" && <span className={"ev-count " + when.tone}>{when.tone === "live" && <i className="live-dot" aria-hidden="true" />}{when.text}</span>}
        </div>
        <strong className="ev-title"><RichText text={e.title} /></strong>
        <span className="ev-host">by {hostedBy(e)}{live && (e.kind === "official" || !!e.orgId) && <VerifiedBadge label={e.kind === "official" ? "Verified: official campus office" : "Verified: club approved by a coordinator"} />}</span>
        <p className="ev-meta">{eventWhen(e)}{e.place && <><span aria-hidden="true"> · </span><MapPin size={12} aria-hidden="true" /> {e.place}</>}</p>
        {e.cohosts.some((c) => c.status === "pending") && e.mineHost && (
          <p className="ev-cohost-note muted">{e.cohosts.filter((c) => c.status === "pending").map((c) => c.name).join(", ")} {e.cohosts.filter((c) => c.status === "pending").length === 1 ? "has" : "have"} been asked to co-host.
            {" "}{e.cohosts.filter((c) => c.status === "pending").map((c) => <button key={c.orgId} type="button" className="link-btn" aria-label={`Withdraw the invitation to ${c.name}`} onClick={() => void eventActions.removeCohost(e.id, c.orgId)}>Withdraw {c.name}</button>)}</p>
        )}
        {e.canceled && <p className="cevent-cancel" role="status">Cancelled</p>}
        {e.status === "pending" && <p className="cevent-note" role="status">A coordinator needs to approve this before other students can see it.</p>}
        {e.status === "rejected" && <p className="cevent-note" role="status">Not approved{e.note ? `: ${e.note}` : "."} You can post it again with changes.</p>}
        {e.status === "removed" && <p className="cevent-note" role="status">A coordinator removed this event, so students cannot see it.{reviewer ? "" : " Ask a coordinator if you think that was a mistake."}</p>}
        {e.status === "removed" && reviewer && <div className="cevent-actions"><button type="button" className="btn" onClick={() => void eventActions.setRemoved(e.id, false)}>Bring it back</button></div>}
        {e.description && (
          <p className={"ev-desc" + (open ? " open" : "")}><RichText text={e.description} />{" "}
            {e.description.length > 110 && <button type="button" className="link-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? "Less" : "More"}</button>}
          </p>
        )}
        {live && (
          <div className="ev-actions">
            {!e.canceled && (
              <div className="ev-answer" role="group" aria-label={`Your answer for ${e.title}`}>
                <button ref={goRef} type="button" className="ev-go" data-a="yes" aria-pressed={going} onClick={toggleGoing}>
                  <Check size={15} aria-hidden="true" /> {going ? "You are going" : "Going"}
                  {burst > 0 && going && <span key={burst} className="ev-burst" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ ["--a" as string]: `${i * 45}deg` }} />)}</span>}
                </button>
                <button type="button" className="ev-maybe" aria-pressed={e.mine === "interested"} onClick={() => eventActions.respond(e.id, e.mine === "interested" ? null : "interested")}><Star size={14} aria-hidden="true" /> Interested</button>
              </div>
            )}
            <span className="ev-people"><Users size={13} aria-hidden="true" /> <b key={e.going}>{e.going}</b> going{e.interested > 0 ? ` · ${e.interested} interested` : ""}</span>
            {canCheckIn && !checked && (ci
              ? <form className="ev-ci-form" onSubmit={async (x) => { x.preventDefault(); const err = await checkinActions.checkIn(e.id, code, { title: e.title, startsAt: e.startsAt, host: e.host }); if (err) { setCiError(err); return; } setCi(false); setCode(""); setCiError(""); cheer.show("You are checked in!"); }}>
                  <input aria-label="Check-in code" autoFocus value={code} maxLength={8} placeholder="Code from the screen" autoCapitalize="characters" onChange={(x) => { setCode(x.target.value.toUpperCase()); setCiError(""); }} />
                  <button className="btn primary" disabled={!code.trim()}>Check in</button><button type="button" className="btn" onClick={() => setCi(false)}>Cancel</button>
                  {ciError && <p className="error" role="alert">{ciError}</p>}
                </form>
              : <button type="button" className="btn" onClick={() => setCi(true)}><QrCode size={14} aria-hidden="true" /> Check in</button>)}
            {e.manage && !e.canceled && <button type="button" className="btn" aria-expanded={runCi} onClick={() => setRunCi((v) => !v)}><QrCode size={14} aria-hidden="true" /> {checkinOpen(e, new Date()) ? "Check-in" : "Attendance"}</button>}
            <span className="ev-more">
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
            </span>
          </div>
        )}
        {runCi && e.manage && <div className="ev-ci-panel"><EventCheckin e={e} /></div>}
      </div>
    </li>
  );
}
