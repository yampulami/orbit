import { useState, type FormEvent } from "react";
import { Check, GraduationCap } from "lucide-react";
import { useAuth } from "../lib/auth";
import { gradLabel, useGradClaims } from "../lib/graduation";
import { notice } from "../lib/notice";
import PersonLink from "./PersonLink";
import Avatar from "./Avatar";

/** In Review, for coordinators: students who say they graduated. Confirm only what you can check (your records, or someone who can); a yes gives the Alumni badge. */
export default function GradQueue() {
  const { session } = useAuth();
  const { claims, review } = useGradClaims(true, session?.user.id);
  const [declining, setDeclining] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const decide = async (id: string, approve: boolean, why = "") => { const p = await review(id, approve, why); if (p) notice.show({ icon: "wifi", title: "That did not work", message: p }); };
  const decline = (e: FormEvent, id: string) => { e.preventDefault(); void decide(id, false, note); setDeclining(null); setNote(""); };

  return (
    <section className="htools-block" aria-label="Graduates to confirm">
      <h3 role="heading" aria-level={2}><GraduationCap size={15} aria-hidden="true" /> Graduates to confirm</h3>
      {claims.length === 0 ? <p className="muted">No one is waiting.</p> : (
        <>
          <p className="muted">Check each against your records before confirming. Confirming gives the Alumni badge and lets them be listed.</p>
          <ul>
            {claims.map((c) => (
              <li key={c.id} className="htools-org">
                <PersonLink id={c.id} className="cf-avlink" decorative><Avatar name={c.name} id={c.id} size={32} /></PersonLink>
                <div className="htools-main">
                  <div className="htools-title"><PersonLink id={c.id} className="who-link"><strong>{c.name}</strong></PersonLink></div>
                  <span className="htools-members">Says they graduated in {gradLabel(c)}{c.proof ? ` · “${c.proof}”` : ""}</span>
                  {declining === c.id && (
                    <form className="al-ask" onSubmit={(e) => decline(e, c.id)}>
                      <label>Tell them why (they see this)
                        <textarea autoFocus rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
                      </label>
                      <div className="al-actions"><button className="btn sm danger">Do not confirm</button><button type="button" className="btn sm" onClick={() => setDeclining(null)}>Cancel</button></div>
                    </form>
                  )}
                </div>
                <div className="htools-row">
                  <button type="button" className="btn" onClick={() => void decide(c.id, true)}><Check size={14} aria-hidden="true" /> Confirm</button>
                  <button type="button" className="btn" onClick={() => { setDeclining(c.id); setNote(""); }}>Can’t confirm</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
