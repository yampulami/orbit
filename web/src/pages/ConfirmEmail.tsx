import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BadgeCheck } from "lucide-react";
import { confirmWithToken, readConfirmParams } from "../lib/confirmEmail";

/** Where the link in the confirmation email lands. It shows a button; pressing it confirms the account and says so. */
export default function ConfirmEmail() {
  const { search } = useLocation();
  const nav = useNavigate();
  const params = readConfirmParams(search);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (!params) return;
    setBusy(true); setError("");
    const problem = await confirmWithToken(params);
    setBusy(false);
    if (problem) setError(problem); else setDone(true);
  }

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
        ) : !params ? (
          <>
            <h1 style={{ fontSize: "1.6rem" }}>This link is not complete</h1>
            <p className="muted">Open the link from your confirmation email again, or sign up to get a new one.</p>
            <Link to="/signup" className="btn primary">Sign up</Link>
            <p className="muted" style={{ fontSize: ".9rem" }}><Link to="/login" style={{ textDecoration: "underline" }}>Back to sign in</Link></p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "1.6rem" }}>Confirm your email</h1>
            <p className="muted">Press the button to finish creating your Orbit account.</p>
            {error && <p className="error" role="alert">{error}</p>}
            <button type="button" className="btn primary" autoFocus disabled={busy} onClick={() => void confirm()}>{busy ? "Confirming…" : "Confirm my account"}</button>
            {error && <p className="muted" style={{ fontSize: ".9rem" }}><Link to="/login" style={{ textDecoration: "underline" }}>Go to sign in</Link></p>}
          </>
        )}
      </div>
    </main>
  );
}
