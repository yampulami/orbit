import { useState } from "react";
import { MessageSquare, Plus, Shapes, Trash2 } from "lucide-react";
import type { Org } from "../lib/campusOrgs";
import type { useClubPods } from "../lib/clubPods";
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
