import { useState } from "react";
import { orgActions, type Org } from "../lib/campusOrgs";
import { notice } from "../lib/notice";

const ago = (iso?: string) => {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} hr ago`;
  return `${Math.round(mins / 1440)} days ago`;
};

/** The owner points the club at its own events page or calendar feed. Orbit reads it every few hours and keeps the club's campus events in step. */
export default function ClubEventSource({ org }: { org: Org }) {
  const [url, setUrl] = useState(org.eventsUrl);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "read">("");
  const changed = url.trim() !== org.eventsUrl;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save"); setError("");
    const err = await orgActions.setEventsUrl(org.id, url);
    setBusy("");
    if (err) { setError(err); return; }
    notice.show({ icon: "calendar", title: url.trim() ? "Events address saved" : "Events address removed", message: url.trim() ? "Use Read it now to bring the events in." : "Events already brought in stay where they are.", ms: 3500 });
  }
  async function read() {
    setBusy("read"); setError("");
    const r = await orgActions.readEventsNow(org.id);
    setBusy("");
    if (r.ok) notice.show({ icon: "calendar", title: "Events read", message: r.message, ms: 4500 });
    else setError(r.message);
  }

  return (
    <section className="esrc" aria-label="Events from your website">
      <p className="muted esrc-help">Paste the address of your events page, or of a calendar feed (the public iCal address from Google Calendar or Outlook). Orbit reads it every few hours and posts new events as {org.name}. A cancelled event is marked cancelled, and one taken off the page is taken down.</p>
      <form className="esrc-row" onSubmit={save}>
        <label className="field esrc-field">Events page or calendar address
          <input type="url" inputMode="url" value={url} maxLength={400} placeholder="https://yourclub.edu/events" onChange={(e) => { setUrl(e.target.value); setError(""); }} />
        </label>
        <button className="btn sm primary" disabled={!changed || busy !== ""}>{busy === "save" ? "Saving…" : "Save"}</button>
        <button type="button" className="btn sm" disabled={!org.eventsUrl || changed || busy !== ""} onClick={() => void read()}>{busy === "read" ? "Reading…" : "Read it now"}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {!error && org.eventsUrl && org.eventsNote && <p className="muted esrc-note">{org.eventsNote} {org.eventsSyncedAt && <span>Last read {ago(org.eventsSyncedAt)}.</span>}</p>}
      {!error && org.eventsUrl && !org.eventsNote && <p className="muted esrc-note">Not read yet. It happens within a few hours, or press Read it now.</p>}
    </section>
  );
}
