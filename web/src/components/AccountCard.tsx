import { useState, type FormEvent } from "react";
import PasswordStrength from "./PasswordStrength";
import { Eye, EyeOff } from "lucide-react";
import { changePassword, checkNewPassword, resetAvailable } from "../lib/passwordReset";

/** Settings: the email this account was made with (people forget which one they used), the username, and a way to change the password.
 *  Private: it only ever renders on your own Settings tab, and nothing here is sent to other people. */
export function AccountCard({ email, username }: { email: string; username: string | null }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function close() { setOpen(false); setCurrent(""); setNext(""); setAgain(""); setError(""); setShow(false); }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const bad = checkNewPassword(next, again) ?? (next === current ? "Choose a password you have not used before." : null);
    if (bad) { setError(bad); return; }
    setBusy(true); setError("");
    const problem = await changePassword(email, current, next);
    setBusy(false);
    if (problem) { setError(problem); return; }
    close(); setDone(true);
  }

  return (
    <section className="track account-card" aria-label="Your account">
      <div className="account-main">
        <h2>Your account</h2>
        <dl className="account-facts">
          <div><dt>Email</dt><dd>{email}</dd></div>
          {username && <div><dt>Username</dt><dd>@{username}</dd></div>}
        </dl>
        <p className="muted">Only you can see this. {username ? "Sign in with either one and your password." : "Sign in with your email and password."}</p>

        {open && (
          <form className="account-form" onSubmit={submit}>
            <label>Current password
              <span className="pwfield"><input type={show ? "text" : "password"} required autoFocus autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
                <button type="button" className="pw-eye" aria-label={show ? "Hide passwords" : "Show passwords"} aria-pressed={show} onClick={() => setShow((v) => !v)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></span>
            </label>
            <label>New password
              <input type={show ? "text" : "password"} required minLength={8} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </label>
            {next && <PasswordStrength value={next} />}
            <label>New password again
              <input type={show ? "text" : "password"} required minLength={8} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
            </label>
            
            {error && <p className="error" role="alert">{error}</p>}
            <div className="account-actions">
              <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
              <button type="button" className="btn" onClick={close}>Cancel</button>
            </div>
          </form>
        )}
        {done && <p className="account-done" role="status">Your password is changed.</p>}
      </div>
      {resetAvailable && !open && <button type="button" className="btn" onClick={() => { setDone(false); setOpen(true); }}>Change password</button>}
    </section>
  );
}
