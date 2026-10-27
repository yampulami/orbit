import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { useCampusEvents } from "../lib/campusEvents";
import { checkinActions, checkinOpen, useMyCheckins } from "../lib/checkin";
import { cheer } from "../lib/cheer";
import { eventWhen } from "../components/EventCard";
import EmptyState from "../components/EmptyState";
import Orb from "../components/Orb";

/** Where scanning the QR code lands. It checks you in straight away, or lets you type the code if the link did not carry one. */
export default function CheckIn() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const { events, ready } = useCampusEvents();
  const { ids } = useMyCheckins();
  const event = events.find((e) => e.id === id);
  const [code, setCode] = useState((params.get("c") ?? "").toUpperCase());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const tried = useRef(false);
  const done = ids.has(id);

  async function go(c: string) {
    if (!event) return;
    setBusy(true);
    const err = await checkinActions.checkIn(event.id, c, { title: event.title, startsAt: event.startsAt, host: event.host });
    setBusy(false);
    if (err) { setError(err); return; }
    cheer.show("You are checked in!");
  }
  // A scanned link carries the code: use it once the event has loaded.
  useEffect(() => { if (event && code && !tried.current && !done) { tried.current = true; void go(code); } }, [event, done]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page checkin-page">
      <Link className="back-link" to="/app/campus"><ArrowLeft size={15} aria-hidden="true" /> Campus</Link>
      {!ready ? <div className="skeleton sk-tile" aria-busy="true" /> : !event ? (
        <EmptyState icon={CalendarDays} title="Event not found">It may be over, cancelled, or not on your campus.</EmptyState>
      ) : done ? (
        <div className="checkin-card">
          <Orb size={96} variant="violet" mood="happy" />
          <h1>You are checked in</h1>
          <p><strong>{event.title}</strong><br /><span className="muted">{eventWhen(event)}</span></p>
          <p className="muted">It is saved on your account. You can see everything you have attended on the Campus page.</p>
        </div>
      ) : (
        <form className="checkin-card" onSubmit={(e) => { e.preventDefault(); void go(code); }}>
          <Orb size={96} variant="violet" mood={busy ? "loading" : "idle"} />
          <h1>Check in</h1>
          <p><strong>{event.title}</strong><br /><span className="muted">{eventWhen(event)}{event.place ? ` · ${event.place}` : ""}</span></p>
          {!checkinOpen(event, new Date()) && <p className="cevent-note" role="status">Check-in is not open yet. It opens an hour before the event starts.</p>}
          <label className="field">Code from the screen<input autoFocus={!code} value={code} maxLength={8} placeholder="ABC 123" autoCapitalize="characters" onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }} /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn primary" disabled={busy || !code.trim()}>{busy ? "Checking in…" : "Check in"}</button>
        </form>
      )}
    </div>
  );
}
