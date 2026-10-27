import { useRef, useState, type FormEvent } from "react";
import { BadgeCheck, CalendarDays, Check, ChevronDown, Clock, Info, MapPin, Megaphone, Plus, Star, UserRound, Users, X } from "lucide-react";
import { eventActions, isOpen, setDemoRole, useCampusEvents, type CampusEvent, type Role } from "../lib/campusEvents";
import { supabase } from "../lib/supabase";
import { notice } from "../lib/notice";
import EmojiButton from "./EmojiButton";
import RichText from "./RichText";
import EmptyState from "./EmptyState";

const when = (e: CampusEvent) => {
  const s = new Date(e.startsAt);
  const day = s.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const t = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${t(s)}${e.endsAt ? ` to ${t(new Date(e.endsAt))}` : ""}`;
};

/** The label that says what kind of event this is, so nobody mistakes it for a private hangout. */
export function EventBadge({ e }: { e: Pick<CampusEvent, "kind" | "status"> }) {
  if (e.status === "pending") return <span className="ebadge wait"><Clock size={12} aria-hidden="true" /> Waiting for approval</span>;
  if (e.status === "rejected") return <span className="ebadge no"><X size={12} aria-hidden="true" /> Not approved</span>;
  return e.kind === "official"
    ? <span className="ebadge official"><BadgeCheck size={12} aria-hidden="true" /> Official campus event</span>
    : <span className="ebadge student"><UserRound size={12} aria-hidden="true" /> Student event</span>;
}

/** The big public events on campus, put on by hosts. Official events come from staff; student events from student hosts and need a staff member's approval.
 *  Anyone can say going or interested. This is different from a group hangout, which is a private plan among friends. */
export default function CampusEvents() {
  const { events, pending, isHost, role, canReview: reviewer, hostLabel, ready } = useCampusEvents();
  const [form, setForm] = useState(false);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [sure, setSure] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const now = new Date();
  const published = events.filter((e) => isOpen(e, now) && e.status !== "pending" && e.status !== "rejected");
  const mineWaiting = events.filter((e) => e.mineHost && (e.status === "pending" || e.status === "rejected") && isOpen(e, now));
  const upcoming = [...mineWaiting, ...published].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const shown = all ? upcoming : upcoming.slice(0, 4);

  return (
    <section className="cevents" aria-label="Campus events">
      <header>
        <div>
          <h2><Megaphone size={18} aria-hidden="true" /> Campus events</h2>
          <p className="muted">Public events for the whole campus, put on by departments, clubs and staff. Your own plans with friends are <strong>hangouts</strong> in Groups.</p>
        </div>
        {isHost && <button type="button" className="btn primary" aria-expanded={form} onClick={() => setForm((v) => !v)}><Plus size={16} aria-hidden="true" />Post an event</button>}
      </header>

      <button type="button" className="cevent-help" aria-expanded={help} onClick={() => setHelp((v) => !v)}><Info size={15} aria-hidden="true" /> What is the difference between events and hangouts? <ChevronDown size={15} aria-hidden="true" className="chev" /></button>
      {help && (
        <dl className="cevent-explain">
          <div><dt><span className="ebadge official"><BadgeCheck size={12} aria-hidden="true" /> Official campus event</span></dt><dd>Posted by staff, like a department, the library or an instructor. Open to everyone at your university.</dd></div>
          <div><dt><span className="ebadge student"><UserRound size={12} aria-hidden="true" /> Student event</span></dt><dd>Put on by a student club or group. A staff member approves it before it appears here. Open to everyone.</dd></div>
          <div><dt><span className="ebadge group"><Users size={12} aria-hidden="true" /> Group hangout</span></dt><dd>A private plan you make with friends in a group. Only the people in that group see it, and it is not an event.</dd></div>
        </dl>
      )}

      {!supabase && (
        <label className="cevent-demo">Preview as
          <select value={role ?? "coordinator"} onChange={(e) => setDemoRole(e.target.value as Role)}>
            <option value="coordinator">Coordinator (can approve)</option>
            <option value="staff">Staff host (publishes Official events)</option>
            <option value="student">Student host (needs approval)</option>
          </select>
        </label>
      )}

      {form && isHost && <EventForm hostLabel={hostLabel} role={role} onDone={() => setForm(false)} />}

      {reviewer && pending.length > 0 && (
        <div className="cevent-queue" role="region" aria-label="Waiting for your approval">
          <h3><Clock size={15} aria-hidden="true" /> Waiting for your approval <span className="rem-count">{pending.length}</span></h3>
          <ul>
            {pending.map((e) => (
              <li key={e.id}>
                <div className="cevent-q-main">
                  <strong><RichText text={e.title} /></strong>
                  <span className="cevent-meta">{e.host} · {when(e)}{e.place ? ` · ${e.place}` : ""}</span>
                  {e.description && <span className="cevent-q-desc"><RichText text={e.description} /></span>}
                </div>
                {declining === e.id ? (
                  <form className="cevent-q-decline" onSubmit={(ev) => { ev.preventDefault(); void eventActions.decline(e.id, reason); setDeclining(null); setReason(""); notice.show({ icon: "calendar", title: "Event declined", message: "The host has been told.", ms: 3500 }); }}>
                    <input aria-label="Reason (optional)" autoFocus value={reason} maxLength={200} placeholder="Reason, so they can fix it (optional)" onChange={(x) => setReason(x.target.value)} />
                    <button className="btn danger">Decline</button><button type="button" className="btn" onClick={() => setDeclining(null)}>Back</button>
                  </form>
                ) : (
                  <div className="cevent-q-actions">
                    <button type="button" className="btn primary" onClick={() => { void eventActions.approve(e.id); notice.show({ icon: "calendar", title: "Event approved", message: "It now shows to everyone on campus as a Student event.", ms: 3500 }); }}><Check size={15} aria-hidden="true" /> Approve</button>
                    <button type="button" className="btn" onClick={() => { setDeclining(e.id); setReason(""); }}>Decline</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!ready ? (
        <div aria-busy="true" aria-label="Loading campus events"><div className="skeleton sk-tile" /></div>
      ) : upcoming.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No campus events yet">When a department, club or instructor posts one, it shows up here and in your bell.</EmptyState>
      ) : (
        <ul className="cevent-list">
          {shown.map((e) => {
            const d = new Date(e.startsAt);
            const expanded = open === e.id;
            const live = e.status === "published";
            return (
              <li key={e.id} className={"cevent " + e.kind + (e.canceled ? " canceled" : "") + (live ? "" : " waiting")}>
                <div className="cevent-date" aria-hidden="true"><b>{d.getDate()}</b><span>{d.toLocaleDateString(undefined, { month: "short" })}</span></div>
                <div className="cevent-body">
                  <EventBadge e={e} />
                  <div className="cevent-top">
                    <strong><RichText text={e.title} /></strong>
                    <span className="cevent-host">by {e.host}</span>
                  </div>
                  <p className="cevent-meta">{when(e)}{e.place && <><span aria-hidden="true"> · </span><MapPin size={12} aria-hidden="true" /> {e.place}</>}</p>
                  {e.canceled && <p className="cevent-cancel" role="status">Cancelled</p>}
                  {e.status === "pending" && <p className="cevent-note" role="status">A staff member needs to approve this before other students can see it.</p>}
                  {e.status === "rejected" && <p className="cevent-note" role="status">Not approved{e.note ? `: ${e.note}` : "."} You can post it again with changes.</p>}
                  {e.description && (
                    <p className={"cevent-desc" + (expanded ? " open" : "")}><RichText text={e.description} />{" "}
                      {e.description.length > 110 && <button type="button" className="link-btn" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : e.id)}>{expanded ? "Less" : "More"}</button>}
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
                      {e.mineHost && !e.canceled && (sure === e.id
                        ? <span className="cevent-sure"><button type="button" className="btn danger" onClick={() => { void eventActions.cancel(e.id); setSure(null); notice.show({ icon: "calendar", title: "Event cancelled", message: "People who said going or interested have been told.", ms: 4000 }); }}>Yes, cancel it</button><button type="button" className="btn" onClick={() => setSure(null)}>Keep it</button></span>
                        : <button type="button" className="btn" onClick={() => setSure(e.id)}>Cancel event</button>)}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {upcoming.length > 4 && <button type="button" className="up-more" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${upcoming.length}`}</button>}
      {!isHost && ready && <p className="cevent-foot muted">Want to put on a campus event? Hosts are set up by your university's events coordinator.</p>}
    </section>
  );
}

function EventForm({ hostLabel, role, onDone }: { hostLabel: string | null; role: Role | null; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [place, setPlace] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const nowLocal = (() => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); })();
  const student = role === "student";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await eventActions.create({ title, description, place, startsAt, endsAt: endsAt || undefined });
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    notice.show(r.status === "pending"
      ? { icon: "calendar", title: "Sent for approval", message: "A staff member will look at it. You will get a notification when it is approved. Until then only you and the reviewers can see it.", ms: 6000 }
      : { icon: "calendar", title: "Event posted", message: "It is live as an Official campus event, and everyone on campus has it in their bell.", ms: 4500 });
    onDone();
  }

  return (
    <form className="cevent-form" onSubmit={submit}>
      <p className="cevent-who">
        Posting as <strong>{hostLabel ?? "host"}</strong> <span className={"ebadge " + (student ? "student" : "official")}>{student ? <><UserRound size={12} aria-hidden="true" /> Student event</> : <><BadgeCheck size={12} aria-hidden="true" /> Official campus event</>}</span>
      </p>
      <p className="muted">{student ? "A staff member approves student events before other students see them." : "This goes live right away, and everyone on your campus is told."}</p>
      <label className="field">Title<input autoFocus value={title} maxLength={120} onChange={(e) => { setTitle(e.target.value); setError(""); }} placeholder="e.g. Study skills workshop" /></label>
      <label className="field">Where<input value={place} maxLength={120} onChange={(e) => setPlace(e.target.value)} placeholder="e.g. Library, room 2B" /></label>
      <div className="cevent-times">
        <label className="field">Starts<input type="datetime-local" min={nowLocal} value={startsAt} onChange={(e) => { setStartsAt(e.target.value); setError(""); }} /></label>
        <label className="field">Ends (optional)<input type="datetime-local" min={startsAt || nowLocal} value={endsAt} onChange={(e) => { setEndsAt(e.target.value); setError(""); }} /></label>
      </div>
      <div className="field">
        <label htmlFor="cevent-desc">What is it about?</label>
        <div className="about-box">
          <textarea id="cevent-desc" ref={area} rows={3} value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} placeholder="A line or two: who it is for, what to bring." />
          <div className="about-tools"><EmojiButton value={description} onChange={setDescription} inputRef={area} max={1000} /><span className="count">{description.length}/1000</span></div>
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="about-actions"><button className="btn primary" disabled={busy}>{busy ? "Posting…" : student ? "Send for approval" : "Post event"}</button><button type="button" className="btn" onClick={onDone}>Cancel</button></div>
    </form>
  );
}
