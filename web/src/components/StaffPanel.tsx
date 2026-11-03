import { useState } from "react";
import { BadgeCheck, ExternalLink } from "lucide-react";
import PersonName from "./PersonName";
import { useStaffTeam } from "../lib/staffClaims";
import { useAuth } from "../lib/auth";
import { notice } from "../lib/notice";

const FROM: Record<string, string> = { manual: "Added by hand", directory: "From the school directory", claim: "Verified from the school's website" };
const ROLE: Record<string, string> = { coordinator: "Coordinator", staff: "Staff", student: "Student host" };

/** For coordinators: who has staff access at this campus and how they got it, requests waiting for a decision, and a way to take access away. */
export default function StaffPanel() {
  const { session } = useAuth();
  const me = session?.user.id;
  const { team, claims, error, remove, decide } = useStaffTeam(true);
  const [confirm, setConfirm] = useState("");

  if (team.length === 0 && claims.length === 0) return null;
  return (
    <section className="htools-block staffp" aria-label="Staff access">
      {claims.length > 0 && (
        <>
          <h3><BadgeCheck size={15} aria-hidden="true" /> Staff access requests <span className="rem-count">{claims.length}</span></h3>
          <ul>
            {claims.map((c) => (
              <li key={c.id} className="staffp-row">
                <div className="htools-main">
                  <strong><PersonName id={c.userId} fallback={c.email} /></strong>
                  <span className="muted">{c.title || "No title found"} · {c.email}</span>
                  {c.url && <a className="staffp-link" href={c.url} target="_blank" rel="noopener noreferrer">Their page <ExternalLink size={12} aria-hidden="true" /></a>}
                </div>
                <div className="htools-row">
                  <button type="button" className="btn sm primary" onClick={async () => { if (!(await decide(c.id, true, "staff"))) notice.show({ icon: "calendar", title: "Approved as staff", message: "They have been told.", ms: 3000 }); }}>Approve as staff</button>
                  <button type="button" className="btn sm" onClick={() => void decide(c.id, true, "coordinator")}>As coordinator</button>
                  <button type="button" className="btn sm" onClick={() => void decide(c.id, false)}>Decline</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>Staff team <span className="rem-count">{team.length}</span></h3>
      <ul>
        {team.map((m) => (
          <li key={m.id} className="staffp-row">
            <div className="htools-main">
              <strong><PersonName id={m.id} fallback={m.label} />{m.id === me && <span className="muted"> (you)</span>}</strong>
              <span className="muted">{ROLE[m.role]} · {m.label} · {FROM[m.source]}</span>
            </div>
            {m.id !== me && (confirm === m.id ? (
              <div className="htools-row">
                <button type="button" className="btn sm danger" onClick={async () => { await remove(m.id); setConfirm(""); }}>Remove access</button>
                <button type="button" className="link-btn" onClick={() => setConfirm("")}>Cancel</button>
              </div>
            ) : <button type="button" className="link-btn" onClick={() => setConfirm(m.id)}>Remove</button>)}
          </li>
        ))}
      </ul>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
