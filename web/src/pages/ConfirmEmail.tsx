import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BadgeCheck } from "lucide-react";
import MercuryStage from "../components/MercuryStage";
import { ThemeToggleButton } from "../components/ThemeControls";
import { confirmWithToken, readConfirmParams, resendConfirmation, type ConfirmFailure } from "../lib/confirmEmail";
import { useCooldown } from "../lib/cooldown";

/** The big button the sign-in screen uses. */
function Primary({ children, onClick, disabled, autoFocus }: { children: ReactNode; onClick: () => void; disabled?: boolean; autoFocus?: boolean }) {
  return (
    <div className="merc-submit">
      <span className="merc-goo" aria-hidden="true"><i className="merc-base" /><i className="merc-drop" /></span>
      <button type="button" className="merc-btn" disabled={disabled} autoFocus={autoFocus} onClick={onClick}>{children}</button>
    </div>
  );
}

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
  const wait = useCooldown("resend:" + email.trim().toLowerCase());

  async function confirm() {
    if (!params || busy) return;
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
    <main className="merc">
      <MercuryStage />
      <div className="merc-theme"><ThemeToggleButton /></div>
      <div className="merc-form" role="region" aria-label="Confirm your email">
        <header className="merc-head">
          <Link to="/" className="merc-brand"><i aria-hidden="true" />Orbit</Link>
          <h1>{done ? <>Account<br />created</> : stuck ? <>Link can't<br />be used</> : <>Confirm<br />your email</>}</h1>
        </header>

        {done ? (
          <>
            <p className="merc-ok" role="status"><BadgeCheck size={20} aria-hidden="true" /><span>Your account was created successfully, and you are signed in.</span></p>
            <Primary autoFocus onClick={() => nav("/app", { replace: true })}>Continue to Orbit</Primary>
          </>
        ) : stuck ? (
          <>
            <p className="merc-note">A confirmation link works once, and stops working after a day. So either:</p>
            <ul className="merc-why">
              <li><b>You already confirmed.</b> You're all set. Log in to carry on.</li>
              <li><b>The link is old</b>, or a newer email replaced it. Get a new one below.</li>
            </ul>
            <Primary onClick={() => nav("/login")}>Log in</Primary>
            <div className="merc-or" role="separator"><span>or get a new link</span></div>
            <form className="merc-new" onSubmit={sendNew}>
              <label className="merc-group"><span>Your email</span>
                <input type="email" required autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setProblem(""); setSent(false); }} placeholder="you@yourschool.edu" />
                <i className="merc-glow" />
              </label>
              {problem && <p className="error" role="alert">{problem}</p>}
              {sent && <p className="notice" role="status">If {email.trim()} is waiting to be confirmed, a new link is on its way. It can take a few minutes, so check your spam folder too.</p>}
              <button className="merc-link" disabled={!email.trim() || sending || wait.left > 0}>{sending ? "Sending…" : wait.left > 0 ? `Email me a new link (wait ${wait.left}s)` : "Email me a new link"}</button>
            </form>
          </>
        ) : (
          <>
            <p className="merc-note">Press the button to finish creating your Orbit account.</p>
            {failure === "slow" && <p className="error" role="alert">Too many tries. Wait a minute, then press the button again.</p>}
            {failure === "other" && <p className="error" role="alert">We could not confirm your account. Check your connection and press the button again.</p>}
            <Primary autoFocus disabled={busy} onClick={() => void confirm()}>{busy ? "Confirming…" : "Confirm my account"}</Primary>
          </>
        )}
      </div>
    </main>
  );
}
