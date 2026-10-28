import { useEffect, useState } from "react";
import { BadgeCheck, Check, Pause, Play, ShieldCheck, UserRound, Users, X } from "lucide-react";
import { orgActions, orgHue, type Org } from "../lib/campusOrgs";
import { notice } from "../lib/notice";
import ClubAbout from "./ClubAbout";
import ApplicationDetails from "./ApplicationDetails";
import RolesPanel from "./RolesPanel";
import RichText from "./RichText";

/** Everything about the club that used to sit on its front: what it is, when it meets, the president's editing, roles, the application and the coordinator's controls. */
const HUES = [262, 285, 315, 340, 10, 35, 150, 190, 215];
const ICONS = ["🤖", "♟️", "🎬", "🎨", "🎵", "⚽", "📚", "🧪", "🌱", "🎮", "🍜", "🚀"];

/** The president picks the club's colour and icon. They tint its rail icon, header and highlights for everyone. */
function LookPicker({ org }: { org: Org }) {
  const hue = orgHue(org);
  return (
    <section className="look" aria-label="Colour and icon">
      <h3 className="about-sub">Colour and icon</h3>
      <div className="look-row" role="radiogroup" aria-label="Colour">
        {HUES.map((h) => (
          <button key={h} type="button" role="radio" aria-checked={hue === h} aria-label={`Colour ${h}`} className="look-sw" style={{ ["--h" as string]: h }} onClick={() => void orgActions.updateLook(org.id, { accent: h, icon: org.icon })} />
        ))}
      </div>
      <div className="look-row" role="radiogroup" aria-label="Icon">
        <button type="button" role="radio" aria-checked={!org.icon} className="look-ic" aria-label="First letter" onClick={() => void orgActions.updateLook(org.id, { accent: org.accent ?? null, icon: "" })}>{org.name.slice(0, 1).toUpperCase()}</button>
        {ICONS.map((i) => (
          <button key={i} type="button" role="radio" aria-checked={org.icon === i} className="look-ic" aria-label={`Icon ${i}`} onClick={() => void orgActions.updateLook(org.id, { accent: org.accent ?? null, icon: i })}>{i}</button>
        ))}
      </div>
    </section>
  );
}

export default function ClubInfoSheet({ org, reviewer, canRoles, seesApplication, onClose }: { org: Org; reviewer: boolean; canRoles: boolean; seesApplication: boolean; onClose: () => void }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const circle = org.kind === "circle";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal cinfo" role="dialog" aria-modal="true" aria-label={`About ${org.name}`}>
        <header className="cinfo-head">
          <span className={"ebadge " + (org.kind === "official" ? "official" : circle ? "group" : "student")}>{org.kind === "official" ? <><BadgeCheck size={12} aria-hidden="true" /> Official</> : circle ? <><Users size={12} aria-hidden="true" /> Student circle</> : <><UserRound size={12} aria-hidden="true" /> Student club</>}</span>
          <button type="button" className="ac-icon" aria-label="Close" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </header>
        <h2 className="cinfo-title"><RichText text={org.name} /></h2>

        <ClubAbout key={org.id + org.about + org.description + org.application.meeting + org.application.category} org={org} canEdit={org.owner} />
        {org.owner && org.status !== "rejected" && <LookPicker org={org} />}
        {seesApplication && <><h3 className="about-sub">The application</h3><ApplicationDetails org={org} /></>}
        {canRoles && org.status === "active" && <RolesPanel org={org} />}

        {reviewer && !org.mine && (
          <div className="club-review" role="group" aria-label="Coordinator controls">
            {org.status === "pending" && (declining ? (
              <form className="htools-row" onSubmit={(e) => { e.preventDefault(); void orgActions.decline(org.id, reason); setDeclining(false); }}>
                <input aria-label="Reason (optional)" autoFocus value={reason} maxLength={200} placeholder="Reason (optional)" onChange={(e) => setReason(e.target.value)} />
                <button className="btn danger">Decline</button><button type="button" className="btn" onClick={() => setDeclining(false)}>Back</button>
              </form>
            ) : (
              <>
                <button type="button" className="btn primary" onClick={() => { void orgActions.approve(org.id); notice.show({ icon: "calendar", title: `${org.name} approved`, message: "Its officers can post events now.", ms: 4000 }); }}><Check size={15} aria-hidden="true" /> Approve club</button>
                <button type="button" className="btn" onClick={() => setDeclining(true)}>Decline</button>
              </>
            ))}
            {org.status === "active" && org.kind === "student" && <button type="button" className="btn" aria-pressed={org.trusted} onClick={() => void orgActions.setTrusted(org.id, !org.trusted)}><ShieldCheck size={14} aria-hidden="true" /> {org.trusted ? "Stop trusting" : "Trust this club"}</button>}
            {org.status === "active" && <button type="button" className="btn" onClick={() => void orgActions.setPaused(org.id, true)}><Pause size={14} aria-hidden="true" /> Pause</button>}
            {org.status === "paused" && <button type="button" className="btn" onClick={() => void orgActions.setPaused(org.id, false)}><Play size={14} aria-hidden="true" /> Resume</button>}
          </div>
        )}
      </div>
    </div>
  );
}
