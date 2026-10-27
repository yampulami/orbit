import { useRef, useState, type FormEvent } from "react";
import { BadgeCheck, UserRound } from "lucide-react";
import { eventActions, type Role } from "../lib/campusEvents";
import { eventsNeedApproval, type Org } from "../lib/campusOrgs";
import { notice } from "../lib/notice";
import EmojiButton from "./EmojiButton";
import DateTimeField from "./DateTimeField";

/** The form for a new campus event. A club's event is posted from inside the club (`org`); a staff host posts as themselves (`hostLabel` and `role`).
 *  It says plainly whether the event goes live at once or waits for a coordinator. */
export default function EventForm({ org, hostLabel, role, onDone }: { org?: Org; hostLabel?: string | null; role?: Role | null; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [place, setPlace] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const nowLocal = (() => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); })();
  const waits = org ? eventsNeedApproval(org) : role === "student";
  const official = org ? org.kind === "official" : !waits;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await eventActions.create({ title, description, place, startsAt, endsAt: endsAt || undefined, orgId: org?.id, orgName: org?.name, orgKind: org?.kind === "official" ? "official" : "student", orgTrusted: org?.trusted });
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    notice.show(r.status === "pending"
      ? { icon: "calendar", title: "Sent for approval", message: "A coordinator will look at it and you will get a notification. Until then only your club's officers and the coordinators can see it.", ms: 6500 }
      : { icon: "calendar", title: "Event posted", message: official ? "It is live as an Official campus event, and everyone on campus has it in their bell." : "It is live as a Student event, and everyone on campus has it in their bell.", ms: 4500 });
    onDone();
  }

  return (
    <form className="cevent-form" onSubmit={submit}>
      <p className="cevent-who">
        Posting as <strong>{org?.name ?? hostLabel ?? "host"}</strong>{" "}
        <span className={"ebadge " + (official ? "official" : "student")}>{official ? <><BadgeCheck size={12} aria-hidden="true" /> Official campus event</> : <><UserRound size={12} aria-hidden="true" /> Student event</>}</span>
      </p>
      <p className="muted">{waits ? "A coordinator approves new events from this club before other students see them." : "This goes live right away, and everyone on your campus is told."}</p>
      <label className="field">Title<input autoFocus value={title} maxLength={120} onChange={(e) => { setTitle(e.target.value); setError(""); }} placeholder="e.g. Open build night" /></label>
      <label className="field">Where<input value={place} maxLength={120} onChange={(e) => setPlace(e.target.value)} placeholder="e.g. Engineering lab" /></label>
      <div className="cevent-times">
        <DateTimeField label="Starts" value={startsAt} min={nowLocal} onChange={(v) => { setStartsAt(v); setError(""); }} />
        <DateTimeField label="Ends (optional)" value={endsAt} min={startsAt || nowLocal} optional placeholder="No end time" onChange={(v) => { setEndsAt(v); setError(""); }} />
      </div>
      <div className="field">
        <label htmlFor="cevent-desc">What is it about?</label>
        <div className="about-box">
          <textarea id="cevent-desc" ref={area} rows={3} value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} placeholder="A line or two: who it is for, what to bring." />
          <div className="about-tools"><EmojiButton value={description} onChange={setDescription} inputRef={area} max={1000} /><span className="count">{description.length}/1000</span></div>
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="about-actions"><button className="btn primary" disabled={busy}>{busy ? "Posting…" : waits ? "Send for approval" : "Post event"}</button><button type="button" className="btn" onClick={onDone}>Cancel</button></div>
    </form>
  );
}
