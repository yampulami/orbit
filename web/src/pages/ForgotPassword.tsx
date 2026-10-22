import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../lib/auth";
import { checkNewPassword, MIN_PASSWORD, resetAvailable, resetWithCode, sendResetCode, validCode } from "../lib/passwordReset";

const RESEND_SECONDS = 60;

/** Forgot password. Step one: your email, and we send a code. Step two: the code and a new password. Then you are signed in. */
export default function ForgotPassword() {
  const { session } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [wait, setWait] = useState(0);

  // A short pause before another code can be asked for.
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  if (session && step === "email") return <Navigate to="/app" replace />;

  async function send(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true); setError(""); setInfo("");
    const problem = await sendResetCode(email);
    setBusy(false);
    if (problem) { setError(problem); return; }
    setStep("code"); setWait(RESEND_SECONDS);
    setInfo(`If ${email.trim()} has an Orbit account, we have emailed it a code. It can take a minute, so check your spam folder too.`);
  }

  async function reset(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!validCode(code)) { setError("Type the number from the email."); return; }
    const bad = checkNewPassword(password, again);
    if (bad) { setError(bad); return; }
    setBusy(true);
    const problem = await resetWithCode(email, code, password);
    setBusy(false);
    if (problem) { setError(problem); return; }
    nav("/app", { replace: true });
  }

  if (!resetAvailable) {
    return (
      <main className="auth">
        <div className="card">
          <Link to="/" className="logo"><i />Orbit</Link>
          <h1 style={{ fontSize: "1.6rem" }}>Forgot password</h1>
          <p className="muted">Password reset needs an account on the server. In demo mode, accounts live only on this device.</p>
          <Link to="/login" className="btn">Back to sign in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="auth">
      {step === "email" ? (
        <form className="card" onSubmit={send}>
          <Link to="/" className="logo"><i />Orbit</Link>
          <h1 style={{ fontSize: "1.6rem" }}>Forgot your password?</h1>
          <p className="muted">Type the email you signed up with and we will send you a code to choose a new one.</p>
          <label className="field">Email<input type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn primary" disabled={busy || !email.trim()}>{busy ? "Sending…" : "Send me a code"}</button>
          <p className="muted" style={{ fontSize: ".9rem" }}><Link to="/login" style={{ textDecoration: "underline" }}>Back to sign in</Link></p>
        </form>
      ) : (
        <form className="card" onSubmit={reset}>
          <Link to="/" className="logo"><i />Orbit</Link>
          <h1 style={{ fontSize: "1.6rem" }}>Check your email</h1>
          {info && <p className="notice" role="status">{info}</p>}
          <label className="field">Code from the email
            <input className="auth-code" type="text" inputMode="numeric" required autoFocus autoComplete="one-time-code" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" />
          </label>
          <label className="field">New password
            <span className="pw">
              <input type={show ? "text" : "password"} required minLength={MIN_PASSWORD} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="pw-eye" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={() => setShow((v) => !v)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </span>
          </label>
          <label className="field">New password again<input type={show ? "text" : "password"} required minLength={MIN_PASSWORD} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Set new password"}</button>
          <button type="button" className="btn" disabled={busy || wait > 0} onClick={() => void send()}>{wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}</button>
          <p className="muted" style={{ fontSize: ".9rem" }}><button type="button" className="linklike" onClick={() => { setStep("email"); setError(""); setInfo(""); setCode(""); }}>Use a different email</button></p>
        </form>
      )}
    </main>
  );
}
