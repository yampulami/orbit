import { useState, type FormEvent } from "react";
import { BadgeCheck, Building2, Check, ChevronDown, Flag, Pause, Play, Plus, UserPlus, UserRound, X } from "lucide-react";
import { orgActions, useCampusOrgs, type Org } from "../lib/campusOrgs";
import { eventActions, useCampusEvents } from "../lib/campusEvents";
import { notice } from "../lib/notice";
import RichText from "./RichText";

const STATUS: Record<Org["status"], string> = { active: "Active", pending: "Waiting for approval", paused: "Paused", rejected: "Not approved" };

/** The organizations side of campus events. Anyone can ask to set up a club or office; a coordinator approves it once, and after that its officers post
 *  events as the organization and they go live at once. Coordinators also see what is waiting, and the events people have reported. */
export default function HostTools({ onPost }: { onPost: (orgId: string) => void }) {
  const { orgs, mine } = useCampusOrgs();
  const { canReview: reviewer, reported } = useCampusEvents();
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [addError, setAddError] = useState("");

  const waiting = orgs.filter((o) => o.status === "pending" && !o.mine);
  const attention = (reviewer ? waiting.length + reported.length : 0);

  async function ask(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await orgActions.request({ name, description: about, reviewer });
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    notice.show(r.status === "pending"
      ? { icon: "calendar", title: "Sent for approval", message: "A coordinator will look at it. You will get a notification. Once it is approved you can post events as this club.", ms: 6000 }
      : { icon: "calendar", title: "Organization ready", message: "You can post events as it now.", ms: 4500 });
    setName(""); setAbout(""); setError(""); setAsking(false);
  }

  async function add(org: Org, e: FormEvent) {
    e.preventDefault();
    const bad = await orgActions.addMember(org.id, username.trim().replace(/^@/, ""));
    if (bad) { setAddError(bad); return; }
    setUsername(""); setAddError(""); setAdding(null);
    notice.show({ icon: "pin", title: "Officer added", message: "They can post events for the club now, and have been told.", ms: 3500 });
  }

  return (
    <section className="htools" aria-label="Host tools">
      <button type="button" className="htools-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Building2 size={16} aria-hidden="true" />
        <span>Host events for a club or office</span>
        {attention > 0 && <span className="rem-count" aria-label={`${attention} need you`}>{attention}</span>}
        <ChevronDown size={16} aria-hidden="true" className="chev" />
      </button>

      {open && (
        <div className="htools-body">
          <p className="muted">A club, department or office is set up once and a coordinator approves it. After that, its officers post events as it and they go live straight away, labelled so everyone knows who is behind them.</p>

          {reviewer && waiting.length > 0 && (
            <div className="htools-block" role="region" aria-label="Clubs waiting for approval">
              <h3>Waiting for approval <span className="rem-count">{waiting.length}</span></h3>
              <ul>
                {waiting.map((o) => (
                  <li key={o.id}>
                    <div className="htools-main"><strong><RichText text={o.name} /></strong>{o.description && <span className="muted"><RichText text={o.description} /></span>}<span className="muted">Asked by {o.members.find((m) => m.role === "owner")?.name ?? "a student"}</span></div>
                    {declining === o.id ? (
                      <form className="htools-row" onSubmit={(e) => { e.preventDefault(); void orgActions.decline(o.id, reason); setDeclining(null); setReason(""); }}>
                        <input aria-label="Reason (optional)" autoFocus value={reason} maxLength={200} placeholder="Reason (optional)" onChange={(x) => setReason(x.target.value)} />
                        <button className="btn danger">Decline</button><button type="button" className="btn" onClick={() => setDeclining(null)}>Back</button>
                      </form>
                    ) : (
                      <div className="htools-row">
                        <button type="button" className="btn primary" onClick={() => { void orgActions.approve(o.id); notice.show({ icon: "calendar", title: `${o.name} approved`, message: "Its officers can post events now.", ms: 3500 }); }}><Check size={15} aria-hidden="true" /> Approve</button>
                        <button type="button" className="btn" onClick={() => { setDeclining(o.id); setReason(""); }}>Decline</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reviewer && reported.length > 0 && (
            <div className="htools-block" role="region" aria-label="Reported events">
              <h3><Flag size={14} aria-hidden="true" /> Reported events <span className="rem-count">{reported.length}</span></h3>
              <ul>
                {reported.map(({ event, reasons }) => (
                  <li key={event.id}>
                    <div className="htools-main"><strong><RichText text={event.title} /></strong><span className="muted">{event.host}</span>{reasons.length > 0 && <span className="htools-why">“{reasons.slice(0, 2).join("”, “")}”</span>}</div>
                    <div className="htools-row">
                      <button type="button" className="btn danger" onClick={() => { void eventActions.setRemoved(event.id, true); notice.show({ icon: "calendar", title: "Event removed", message: "It is hidden from students. You can bring it back from the list.", ms: 4000 }); }}>Remove event</button>
                      <button type="button" className="btn" onClick={() => void eventActions.dismissReports(event.id)}>It is fine</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="htools-block">
            <h3>{reviewer ? "Organizations" : "Your clubs and offices"}</h3>
            {(reviewer ? orgs : mine).length === 0 && <p className="muted">{reviewer ? "No organizations yet." : "You are not an officer of any club or office yet."}</p>}
            <ul>
              {(reviewer ? orgs : mine).filter((o) => !(reviewer && o.status === "pending" && !o.mine)).map((o) => (
                <li key={o.id} className="htools-org">
                  <div className="htools-main">
                    <div className="htools-title">
                      <strong><RichText text={o.name} /></strong>
                      <span className={"ebadge " + (o.kind === "official" ? "official" : "student")}>{o.kind === "official" ? <><BadgeCheck size={12} aria-hidden="true" /> Official</> : <><UserRound size={12} aria-hidden="true" /> Student club</>}</span>
                      <span className={"ebadge " + (o.status === "active" ? "group" : o.status === "pending" ? "wait" : "no")}>{STATUS[o.status]}</span>
                    </div>
                    {o.description && <span className="muted"><RichText text={o.description} /></span>}
                    {o.note && o.status === "rejected" && <span className="muted">Reason: {o.note}</span>}
                    <span className="htools-members">{o.members.map((m) => `${m.name}${m.role === "owner" ? " (owner)" : ""}`).join(", ")}</span>
                  </div>
                  <div className="htools-row">
                    {o.mine && o.status === "active" && <button type="button" className="btn primary" onClick={() => onPost(o.id)}><Plus size={15} aria-hidden="true" /> Post an event</button>}
                    {o.owner && o.status !== "rejected" && <button type="button" className="btn" aria-expanded={adding === o.id} onClick={() => { setAdding(adding === o.id ? null : o.id); setUsername(""); setAddError(""); }}><UserPlus size={15} aria-hidden="true" /> Add an officer</button>}
                    {reviewer && o.status === "active" && <button type="button" className="btn" onClick={() => void orgActions.setPaused(o.id, true)}><Pause size={14} aria-hidden="true" /> Pause</button>}
                    {reviewer && o.status === "paused" && <button type="button" className="btn" onClick={() => void orgActions.setPaused(o.id, false)}><Play size={14} aria-hidden="true" /> Resume</button>}
                  </div>
                  {adding === o.id && (
                    <form className="htools-row htools-add" onSubmit={(e) => void add(o, e)}>
                      <span className="onb-at"><span aria-hidden="true">@</span><input aria-label="Username" autoFocus value={username} maxLength={20} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="their username" onChange={(e) => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")); setAddError(""); }} /></span>
                      <button className="btn primary" disabled={!username}>Add</button>
                      {addError && <p className="error" role="alert">{addError}</p>}
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {asking ? (
            <form className="htools-form" onSubmit={ask}>
              <label className="field">Name of the club or office<input autoFocus value={name} maxLength={80} placeholder="e.g. Chess Club" onChange={(e) => { setName(e.target.value); setError(""); }} /></label>
              <label className="field">What is it? (a line or two)<textarea rows={2} value={about} maxLength={300} placeholder="Who it is for and what you do." onChange={(e) => setAbout(e.target.value)} /></label>
              {error && <p className="error" role="alert">{error}</p>}
              <div className="about-actions"><button className="btn primary" disabled={busy}>{busy ? "Sending…" : reviewer ? "Create it" : "Send for approval"}</button><button type="button" className="btn" onClick={() => setAsking(false)}><X size={14} aria-hidden="true" /> Cancel</button></div>
            </form>
          ) : (
            <button type="button" className="btn" onClick={() => setAsking(true)}><Plus size={16} aria-hidden="true" /> {reviewer ? "Set up a club or office" : "Ask to host events for a club"}</button>
          )}
        </div>
      )}
    </section>
  );
}
