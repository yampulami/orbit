import { useState, type FormEvent } from "react";
import { Check, GraduationCap } from "lucide-react";
import { useAuth } from "../lib/auth";
import { gradLabel, useGradClaims, type GradClaim } from "../lib/graduation";
import { notice } from "../lib/notice";
import { undo } from "../lib/undo";
import PersonLink from "./PersonLink";
import Avatar from "./Avatar";

/** What can be checked against the school's records. */
function Facts({ c }: { c: GradClaim }) {
  return (
    <dl className="gq-facts">
      <div><dt>Graduated</dt><dd>{gradLabel(c)}</dd></div>
      <div><dt>Major</dt><dd>{c.major || "Not given"}</dd></div>
      <div><dt>Name on degree</dt><dd>{c.gradName || "Not given"}</dd></div>
      <div><dt>Signed in with</dt><dd>@{c.emailDomain}</dd></div>
      {c.proof && <div><dt>They added</dt><dd>{c.proof}</dd></div>}
    </dl>
  );
}

/** A reason, which the student reads. It stays in the box if sending fails. */
function Reason({ ask, action, onSend, onCancel }: { ask: string; action: string; onSend: (why: string) => Promise<string | null>; onCancel: () => void }) {
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!why.trim()) { setError("Say why, so they know what to fix."); return; }
    setBusy(true); setError("");
    const p = await onSend(why);
    setBusy(false);
    if (p) setError(p); else onCancel();
  }
  return (
    <form className="al-ask" onSubmit={send}>
      <label>{ask}<textarea autoFocus rows={2} maxLength={200} value={why} onChange={(e) => setWhy(e.target.value)} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="al-actions"><button className="btn sm danger" disabled={busy}>{busy ? "Sending…" : action}</button><button type="button" className="btn sm" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

/** In Review, for coordinators: students who say they graduated, and the confirmed ones in case one was a mistake. */
export default function GradQueue() {
  const { session } = useAuth();
  const { claims, verified, review, revoke } = useGradClaims(true, session?.user.id);
  const [open, setOpen] = useState<string | null>(null);
  const [held, setHeld] = useState<string[]>([]); // confirmed a moment ago: still takeable back
  const waiting = claims.filter((c) => !held.includes(c.id));
  const confirm = (c: GradClaim) => {
    setHeld((h) => [...h, c.id]);
    undo.show(`${c.name} confirmed. They are told in a moment.`, {
      ms: 8000,
      onUndo: () => setHeld((h) => h.filter((x) => x !== c.id)),
      commit: async () => { const p = await review(c.id, true); setHeld((h) => h.filter((x) => x !== c.id)); if (p) { notice.show({ icon: "alert", title: "That did not work", message: p }); throw new Error(p); } },
    });
  };

  return (
    <section className="htools-block" aria-label="Graduates to confirm">
      <h3 role="heading" aria-level={2}><GraduationCap size={15} aria-hidden="true" /> Graduates to confirm {waiting.length > 0 && <span className="rem-count">{waiting.length}</span>}</h3>
      {waiting.length === 0 ? <p className="muted">No one is waiting.</p> : (
        <>
          <p className="muted">Check the major and name against your records before confirming. Confirming gives the Alumni badge and lets them be listed.</p>
          <ul>
            {waiting.map((c) => (
              <li key={c.id} className="htools-org">
                <PersonLink id={c.id} className="cf-avlink" decorative><Avatar name={c.name} id={c.id} size={32} /></PersonLink>
                <div className="htools-main">
                  <div className="htools-title"><PersonLink id={c.id} className="who-link"><strong>{c.name}</strong></PersonLink></div>
                  <Facts c={c} />
                  {open === c.id && <Reason ask="Why can’t you confirm it? They see this." action="Do not confirm" onSend={(why) => review(c.id, false, why)} onCancel={() => setOpen(null)} />}
                </div>
                <div className="htools-row">
                  <button type="button" className="btn" onClick={() => confirm(c)}><Check size={14} aria-hidden="true" /> Confirm</button>
                  <button type="button" className="btn" onClick={() => setOpen(c.id)}>Can’t confirm</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {verified.length > 0 && (
        <details className="gq-done">
          <summary>Confirmed graduates ({verified.length})</summary>
          <ul>
            {verified.map((c) => (
              <li key={c.id} className="htools-org">
                <div className="htools-main">
                  <div className="htools-title"><PersonLink id={c.id} className="who-link"><strong>{c.name}</strong></PersonLink></div>
                  <span className="htools-members">{[gradLabel(c), c.major, c.gradName].filter(Boolean).join(" · ")}</span>
                  {open === c.id && <Reason ask="Why are you taking it back? They see this." action="Take back" onSend={(why) => revoke(c.id, why)} onCancel={() => setOpen(null)} />}
                </div>
                <div className="htools-row"><button type="button" className="btn" onClick={() => setOpen(c.id)}>Take back</button></div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
