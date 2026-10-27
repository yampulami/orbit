import { useState } from "react";
import { CalendarPlus, Check, MapPin, MessageSquare, Plus, Shapes, Trash2 } from "lucide-react";
import type { Org } from "../lib/campusOrgs";
import type { Meetup, Pod, useClubPods } from "../lib/clubPods";
import DateTimeField from "./DateTimeField";
import EmptyState from "./EmptyState";

const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

/** The club's pods: small groups for a shared interest inside the club. Join one and its private chat opens for you. */
export default function PodsPanel({ org, pods, openChat }: { org: Org; pods: ReturnType<typeof useClubPods>; openChat: (channelId: string) => void }) {
  const inClub = org.myJoin === "officer" || org.myJoin === "member";
  const canManage = org.owner || org.myPerms.includes("channels");
  const [making, setMaking] = useState(false);
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [error, setError] = useState("");
  const [sure, setSure] = useState("");

  async function make(e: React.FormEvent) {
    e.preventDefault();
    const err = await pods.actions.create(name, about);
    if (err) { setError(err); return; }
    setMaking(false); setName(""); setAbout(""); setError("");
  }
  if (!inClub) return null;
  return (
    <section className="club-section pods" aria-label="Pods">
      <div className="cevents-top"><h2>Pods</h2>{canManage && !making && <button type="button" className="btn" onClick={() => setMaking(true)}><Plus size={15} aria-hidden="true" /> New pod</button>}</div>
      <p className="muted">Small groups inside the club for a shared interest. Join one to get its own chat.</p>
      {making && (
        <form className="role-form" onSubmit={make}>
          <label className="field">Pod name<input autoFocus value={name} maxLength={40} placeholder="e.g. Portrait" onChange={(e) => { setName(e.target.value); setError(""); }} /></label>
          <label className="field">What is it about? (optional)<input value={about} maxLength={160} onChange={(e) => setAbout(e.target.value)} /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="about-actions"><button className="btn primary" disabled={!name.trim()}>Create pod</button><button type="button" className="btn" onClick={() => { setMaking(false); setError(""); }}>Cancel</button></div>
        </form>
      )}
      {!pods.ready ? <div className="skeleton sk-tile" aria-busy="true" /> : pods.pods.length === 0 ? (
        <EmptyState icon={Shapes} title="No pods yet">{canManage ? "Make a pod for each interest in your club, like Portrait or Street photography." : "When the team makes pods, you can join them here."}</EmptyState>
      ) : (
        <ul className="pod-list">
          {pods.pods.map((p) => (
            <li key={p.id} className={"pod-card" + (p.mine ? " mine" : "")}>
              <div className="pod-head"><strong>{p.name}</strong>
                {canManage && (sure === p.id
                  ? <span className="cevent-sure"><button type="button" className="btn danger" onClick={() => { void pods.actions.remove(p.id); setSure(""); }}>Delete pod</button><button type="button" className="btn" onClick={() => setSure("")}>Keep</button></span>
                  : <button type="button" className="link-btn" aria-label={`Delete ${p.name}`} onClick={() => setSure(p.id)}><Trash2 size={13} aria-hidden="true" /></button>)}
              </div>
              {p.description && <p className="muted">{p.description}</p>}
              {(p.mine || org.mine) && <PodMeetups pod={p} pods={pods} canJoin={p.mine} canModerate={org.myPerms.includes("moderate")} />}
              <div className="pod-foot">
                <span className="faces" aria-hidden="true">{p.members.slice(0, 4).map((m) => <i key={m.id}>{initials(m.name)}</i>)}</span>
                <span className="muted">{p.members.length} {p.members.length === 1 ? "member" : "members"}</span>
                <span className="pod-actions">
                  {p.mine && p.channelId && <button type="button" className="btn" onClick={() => openChat(p.channelId!)}><MessageSquare size={14} aria-hidden="true" /> Open chat</button>}
                  {p.mine ? <button type="button" className="link-btn" onClick={() => void pods.actions.leave(p.id)}>Leave</button> : <button type="button" className="btn primary" onClick={() => void pods.actions.join(p.id)}>Join pod</button>}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const dayStub = (iso: string) => { const d = new Date(iso); return { mon: d.toLocaleDateString(undefined, { month: "short" }), day: d.getDate(), time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }), dow: d.toLocaleDateString(undefined, { weekday: "short" }) }; };

/** A pod's meetups: plan one, and the rest of the pod says they are in. Only the pod's members and the team see them. */
function PodMeetups({ pod, pods, canJoin, canModerate }: { pod: Pod; pods: ReturnType<typeof useClubPods>; canJoin: boolean; canModerate: boolean }) {
  const [open, setOpen] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [details, setDetails] = useState("");
  const [when, setWhen] = useState("");
  const [error, setError] = useState("");
  const nowLocal = (() => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); })();

  async function plan(e: React.FormEvent) {
    e.preventDefault();
    const err = await pods.actions.createMeetup(pod.id, { title, details, place, startsAt: when });
    if (err) { setError(err); return; }
    setPlanning(false); setTitle(""); setPlace(""); setDetails(""); setWhen(""); setError(""); setOpen(true);
  }
  const m = pod.meetups;
  return (
    <div className="pod-meets">
      <button type="button" className="link-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}><CalendarPlus size={14} aria-hidden="true" /> Meetups{m.length > 0 ? ` (${m.length})` : ""}</button>
      {open && (
        <>
          {m.length === 0 && !planning && <p className="muted">No meetups planned.</p>}
          <ul className="meet-list">{m.map((x) => <MeetupRow key={x.id} m={x} pods={pods} canJoin={canJoin} canCancel={x.planned || canModerate} />)}</ul>
          {canJoin && (planning ? (
            <form className="meet-form" onSubmit={plan}>
              <label className="field">What is the plan?<input autoFocus value={title} maxLength={80} placeholder="e.g. Golden hour photo walk" onChange={(e) => { setTitle(e.target.value); setError(""); }} /></label>
              <label className="field">Where<input value={place} maxLength={120} placeholder="e.g. Library steps" onChange={(e) => setPlace(e.target.value)} /></label>
              <DateTimeField label="When" value={when} min={nowLocal} onChange={(v) => { setWhen(v); setError(""); }} />
              <label className="field">Details (optional)<input value={details} maxLength={300} onChange={(e) => setDetails(e.target.value)} /></label>
              {error && <p className="error" role="alert">{error}</p>}
              <div className="about-actions"><button className="btn primary" disabled={!title.trim() || !when}>Plan it</button><button type="button" className="btn" onClick={() => { setPlanning(false); setError(""); }}>Cancel</button></div>
            </form>
          ) : <button type="button" className="btn" onClick={() => setPlanning(true)}><Plus size={14} aria-hidden="true" /> Plan a meetup</button>)}
        </>
      )}
    </div>
  );
}

function MeetupRow({ m, pods, canJoin, canCancel }: { m: Meetup; pods: ReturnType<typeof useClubPods>; canJoin: boolean; canCancel: boolean }) {
  const [sure, setSure] = useState(false);
  const d = dayStub(m.startsAt);
  return (
    <li className="meet">
      <div className="meet-stub" aria-hidden="true"><span>{d.mon}</span><b>{d.day}</b></div>
      <div className="meet-body">
        <strong>{m.title}</strong>
        <span className="muted">{d.dow} {d.time}{m.place && <> · <MapPin size={11} aria-hidden="true" /> {m.place}</>} · planned by {m.host}</span>
        {m.details && <span className="muted">{m.details}</span>}
        <div className="meet-actions">
          {canJoin && <button type="button" className="btn" aria-pressed={m.going} onClick={() => void pods.actions.rsvp(m.id, !m.going)}>{m.going ? <><Check size={14} aria-hidden="true" /> I am in</> : "I am in"}</button>}
          <span className="muted" title={m.people.join(", ")}>{m.goingCount} {m.goingCount === 1 ? "person is" : "people are"} in</span>
          {canCancel && (sure
            ? <span className="cevent-sure"><button type="button" className="btn danger" onClick={() => void pods.actions.cancelMeetup(m.id)}>Cancel meetup</button><button type="button" className="btn" onClick={() => setSure(false)}>Keep</button></span>
            : <button type="button" className="link-btn" aria-label={`Cancel ${m.title}`} onClick={() => setSure(true)}><Trash2 size={13} aria-hidden="true" /></button>)}
        </div>
      </div>
    </li>
  );
}
