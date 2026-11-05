import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BadgeCheck } from "lucide-react";
import { confirmWithToken, readConfirmParams, resendConfirmation, type ConfirmFailure } from "../lib/confirmEmail";
import { useCooldown } from "../lib/cooldown";

/** Where the link in the confirmation email lands. It shows a button; pressing it confirms the account and says so. If the link cannot be used, it says
 *  why and what to do next, and lets the person ask for a new one. */
export default function ConfirmEmail() {
  const { search } = useLocation();
  const nav = useNavigate();
  const params = readConfirmParams(search);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState<ConfirmFailure | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState("");
  const wait = useCooldown("resend:" + email.trim());

  async function confirm() {
    if (!params) return;
    setBusy(true); setFailure(null);
    const f = await confirmWithToken(params);
    setBusy(false);
    if (f) setFailure(f); else setDone(true);
  }

  async function sendNew(e: FormEvent) {
    e.preventDefault();
    if (wait.left > 0 || sending) return;
    setSending(true); setProblem(""); setSent(false);
    const p = await resendConfirmation(email);
    setSending(false);
    if (p) { setProblem(p); return; }
    setSent(true); wait.start();
  }

  const stuck = failure === "used" || !params;

  return (
    <main className="auth">
      <div className="card" role="region" aria-label="Confirm your email">
        <Link to="/" className="logo"><i />Orbit</Link>
        {done ? (
          <>
            <h1 style={{ fontSize: "1.6rem" }}>Account created</h1>
            <p className="ce-ok" role="status"><BadgeCheck size={18} aria-hidden="true" /> Your account was created successfully, and you are signed in.</p>
            <button type="button" className="btn primary" autoFocus onClick={() => nav("/app", { replace: true })}>Continue to Orbit</button>
          </>
        ) : stuck ? (
          <>
            <h1 style={{ fontSize: "1.6rem" }}>This link can't be used</h1>
            <p className="muted">A confirmation link works once, and stops working after a day. That means one of two things:</p>
            <ol className="ce-why">
              <li><b>You already confirmed your account.</b> Then you're all set. Log in to carry on.</li>
              <li><b>The link is old, or a newer email replaced it.</b> Ask for a new one below, and use the newest email.</li>
            </ol>
            <Link to="/login" className="btn primary">Log in</Link>
            <form className="ce-new" onSubmit={sendNew}>
              <h2>Need a new link?</h2>
              <label className="field">Your email
                <input type="email" required autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setProblem(""); setSent(false); }} placeholder="you@yourschool.edu" />
              </label>
              {problem && <p className="error" role="alert">{problem}</p>}
              {sent && <p className="notice" role="status">If {email.trim()} is waiting to be confirmed, a new link is on its way. It can take a few minutes, so check your spam folder too.</p>}
              <button className="btn" disabled={!email.trim() || sending || wait.left > 0}>{sending ? "Sending…" : wait.left > 0 ? `Email me a new link (wait ${wait.left}s)` : "Email me a new link"}</button>
            </form>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "1.6rem" }}>Confirm your email</h1>
            <p className="muted">Press the button to finish creating your Orbit account.</p>
            {failure === "slow" && <p className="error" role="alert">Too many tries. Wait a minute, then press the button again.</p>}
            {failure === "other" && <p className="error" role="alert">We could not confirm your account. Check your connection and press the button again.</p>}
            <button type="button" className="btn primary" autoFocus disabled={busy} onClick={() => void confirm()}>{busy ? "Confirming…" : "Confirm my account"}</button>
          </>
        )}
      </div>
    </main>
  );
}
