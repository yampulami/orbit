import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { confirmBackupCode, looksLikeAddress, promoteBackupEmail, removeBackupEmail, sendBackupCode, useBackupEmail } from "../lib/backupEmail";
import { notice } from "../lib/notice";

type Step = "idle" | "address" | "code" | "remove" | "switch";

/** Settings: a personal email for the account, so Orbit (and the people you met here) stays reachable after the school deletes your school address.
 *  Both addresses sign you in and reset your password. Changing it asks for your password, and both addresses get a notice. Only you can see this. */
export default function PersonalEmail({ schoolEmail }: { schoolEmail: string }) {
  const { session, refresh } = useAuth();
  const { email, reload } = useBackupEmail(session?.user.id);
  const [step, setStep] = useState<Step>("idle");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const cancel = () => { setStep("idle"); setAddress(""); setPassword(""); setCode(""); setError(""); };

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!looksLikeAddress(address)) { setError("That does not look like an email address."); return; }
    if (!password) { setError("Enter your password to continue."); return; }
    setBusy(true); setError("");
    const problem = await sendBackupCode(address, password);
    setBusy(false);
    if (problem) { setError(problem); return; }
    setStep("code");
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const problem = await confirmBackupCode(code);
    setBusy(false);
    if (problem) { setError(problem); return; }
    cancel(); void reload();
    notice.show({ icon: "wifi", title: "Personal email added", message: "You can now sign in with it, and it will still work after your school email is gone.", ms: 6000 });
  }

  async function withPassword(e: FormEvent, run: (pw: string) => Promise<string | null>, done: { title: string; message: string }) {
    e.preventDefault();
    if (!password) { setError("Enter your password to continue."); return; }
    setBusy(true); setError("");
    const problem = await run(password);
    setBusy(false);
    if (problem) { setError(problem); return; }
    cancel(); void reload(); refresh();
    notice.show({ icon: "wifi", ...done, ms: 6000 });
  }

  const pwField = (
    <label>Your Orbit password
      <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
    </label>
  );

  return (
    <section className="track account-card" aria-label="Personal email">
      <div className="account-main">
        <h2>Keep your account after graduation</h2>
        <p className="muted">Schools delete student email after graduation. Add a personal email now and your Orbit account, your clubs and the people you know here stay with you. Either address can sign you in.</p>
        <dl className="account-facts">
          <div><dt>School email</dt><dd>{schoolEmail}</dd></div>
          <div><dt>Personal email</dt><dd>{email === undefined ? "…" : email ?? "Not added yet"}</dd></div>
        </dl>

        {step === "address" && (
          <form className="account-form" onSubmit={send}>
            <label>Your personal email
              <input type="email" required autoFocus autoComplete="email" inputMode="email" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="you@gmail.com" />
            </label>
            {pwField}
            {error && <p className="error" role="alert">{error}</p>}
            <div className="account-actions">
              <button className="btn primary" disabled={busy}>{busy ? "Sending…" : "Send me a code"}</button>
              <button type="button" className="btn" onClick={cancel}>Cancel</button>
            </div>
          </form>
        )}
        {step === "code" && (
          <form className="account-form" onSubmit={confirm}>
            <label>The 6 digit code we sent to {address.trim()}
              <input required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <div className="account-actions">
              <button className="btn primary" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Confirm"}</button>
              <button type="button" className="link-btn" onClick={() => void send()} disabled={busy}>Send a new code</button>
              <button type="button" className="btn" onClick={cancel}>Cancel</button>
            </div>
          </form>
        )}
        {step === "remove" && (
          <form className="account-form" onSubmit={(e) => withPassword(e, removeBackupEmail, { title: "Personal email removed", message: "Only your school email signs you in now." })}>
            <p className="muted">Remove {email}? It will stop signing you in. Both addresses get a notice.</p>
            {pwField}
            {error && <p className="error" role="alert">{error}</p>}
            <div className="account-actions">
              <button className="btn danger" disabled={busy}>{busy ? "Removing…" : "Remove it"}</button>
              <button type="button" className="btn" onClick={cancel}>Cancel</button>
            </div>
          </form>
        )}
        {step === "switch" && (
          <form className="account-form" onSubmit={(e) => withPassword(e, promoteBackupEmail, { title: "Your account now uses your personal email", message: "The school address no longer works for it. Sign in with your personal email from now on." })}>
            <p className="muted">Use this once your school email is gone or you no longer want it on the account. {email} becomes the account email and {schoolEmail} stops working for it, so nobody who is later given that school address can use it. Both addresses get a notice.</p>
            {pwField}
            {error && <p className="error" role="alert">{error}</p>}
            <div className="account-actions">
              <button className="btn primary" disabled={busy}>{busy ? "Switching…" : "Make it my account email"}</button>
              <button type="button" className="btn" onClick={cancel}>Cancel</button>
            </div>
          </form>
        )}
      </div>
      {step === "idle" && email !== undefined && (email
        ? <div className="account-actions"><button type="button" className="btn" onClick={() => setStep("switch")}>My school email is gone</button><button type="button" className="link-btn" onClick={() => setStep("remove")}>Remove</button></div>
        : <button type="button" className="btn primary" onClick={() => setStep("address")}>Add personal email</button>)}
    </section>
  );
}
