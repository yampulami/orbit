import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { confirmBackupCode, looksLikeAddress, removeBackupEmail, sendBackupCode, useBackupEmail } from "../lib/backupEmail";
import { notice } from "../lib/notice";

/** Settings: a personal email for the account, so Orbit (and the people you met here) stays reachable after the school deletes your school address.
 *  Both addresses sign you in and reset your password. Only you can see this. */
export default function PersonalEmail({ schoolEmail }: { schoolEmail: string }) {
  const { session } = useAuth();
  const { email, reload } = useBackupEmail(session?.user.id);
  const [step, setStep] = useState<"idle" | "address" | "code">("idle");
  const [address, setAddress] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const cancel = () => { setStep("idle"); setAddress(""); setCode(""); setError(""); };

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!looksLikeAddress(address)) { setError("That does not look like an email address."); return; }
    setBusy(true); setError("");
    const problem = await sendBackupCode(address);
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

  async function remove() {
    const problem = await removeBackupEmail();
    if (problem) { notice.show({ icon: "wifi", title: "That did not work", message: problem }); return; }
    void reload();
  }

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
      </div>
      {step === "idle" && email !== undefined && (email
        ? <button type="button" className="btn" onClick={() => void remove()}>Remove</button>
        : <button type="button" className="btn primary" onClick={() => setStep("address")}>Add personal email</button>)}
    </section>
  );
}
