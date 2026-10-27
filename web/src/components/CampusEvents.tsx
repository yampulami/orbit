import { useState, type FormEvent } from "react";
import { CalendarDays, Check, MapPin, Megaphone, Plus, Star, Users } from "lucide-react";
import { eventActions, isOpen, useCampusEvents, type CampusEvent } from "../lib/campusEvents";
import { notice } from "../lib/notice";
import EmojiButton from "./EmojiButton";
import RichText from "./RichText";
import EmptyState from "./EmptyState";
import { useRef } from "react";

const when = (e: CampusEvent) => {
  const s = new Date(e.startsAt);
  const day = s.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const t = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${t(s)}${e.endsAt ? ` to ${t(new Date(e.endsAt))}` : ""}`;
};

/** The big public events on campus, put on by hosts (departments, clubs, instructors, staff). Anyone can say going or interested; hosts can post and cancel. */
export default function CampusEvents() {
  const { events, isHost, hostLabel, ready } = useCampusEvents();
  const [form, setForm] = useState(false);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [sure, setSure] = useState<string | null>(null);

  const now = new Date();
  const upcoming = events.filter((e) => isOpen(e, now));
  const shown = all ? upcoming : upcoming.slice(0, 4);

  return (
    <section className="cevents" aria-label="Campus events">
      <header>
        <div>
          <h2><Megaphone size={18} aria-hidden="true" /> Campus events</h2>
          <p className="muted">Open to everyone at your university. Groups are for your own circle; these are for the whole campus.</p>
        </div>
        {isHost && <button type="button" className="btn primary" aria-expanded={form} onClick={() => setForm((v) => !v)}><Plus size={16} aria-hidden="true" />Post an event</button>}
      </header>

      {form && isHost && <EventForm hostLabel={hostLabel} onDone={() => setForm(false)} />}

      {!ready ? (
        <div aria-busy="true" aria-label="Loading campus events"><div className="skeleton sk-tile" /></div>
      ) : upcoming.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No campus events yet">When a department, club or instructor posts one, it shows up here and in your bell.</EmptyState>
      ) : (
        <ul className="cevent-list">
          {shown.map((e) => {
            const d = new Date(e.startsAt);
            const expanded = open === e.id;
            return (
              <li key={e.id} className={"cevent" + (e.canceled ? " canceled" : "")}>
                <div className="cevent-date" aria-hidden="true"><b>{d.getDate()}</b><span>{d.toLocaleDateString(undefined, { month: "short" })}</span></div>
                <div className="cevent-body">
                  <div className="cevent-top">
                    <strong><RichText text={e.title} /></strong>
                    <span className="cevent-host">{e.host}</span>
                  </div>
                  <p className="cevent-meta">{when(e)}{e.place && <><span aria-hidden="true"> · </span><MapPin size={12} aria-hidden="true" /> {e.place}</>}</p>
                  {e.canceled && <p className="cevent-cancel" role="status">Cancelled</p>}
                  {e.description && (
                    <p className={"cevent-desc" + (expanded ? " open" : "")}><RichText text={e.description} />{" "}
                      {e.description.length > 110 && <button type="button" className="link-btn" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : e.id)}>{expanded ? "Less" : "More"}</button>}
                    </p>
                  )}
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
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {upcoming.length > 4 && <button type="button" className="up-more" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${upcoming.length}`}</button>}
    </section>
  );
}

function EventForm({ hostLabel, onDone }: { hostLabel: string | null; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [place, setPlace] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const nowLocal = (() => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); })();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const problem = await eventActions.create({ title, description, place, startsAt, endsAt: endsAt || undefined });
    setBusy(false);
    if (problem) { setError(problem); return; }
    notice.show({ icon: "calendar", title: "Event posted", message: "Everyone on your campus can see it, and it is in their bell.", ms: 4000 });
    onDone();
  }

  return (
    <form className="cevent-form" onSubmit={submit}>
      <p className="muted">Posting as <strong>{hostLabel ?? "host"}</strong>. Everyone on your campus is told.</p>
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
      <div className="about-actions"><button className="btn primary" disabled={busy}>{busy ? "Posting…" : "Post event"}</button><button type="button" className="btn" onClick={onDone}>Cancel</button></div>
    </form>
  );
}
