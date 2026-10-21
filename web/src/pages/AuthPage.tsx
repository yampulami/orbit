import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../lib/auth";

export default function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const { session, demo, signIn, signUp, signInGuest } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Already signed in: the app (or onboarding, if it is not finished yet) decides where to go.
  if (session) return <Navigate to="/app" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setNotice("");
    const problem = mode === "login" ? await signIn(email, password) : await signUp(email, password);
    if (problem) setError(problem);
    else if (mode === "signup" && !demo) setNotice("Check your email to confirm your account, then sign in.");
    else nav(mode === "signup" ? "/onboarding" : "/app", { replace: true });
    setBusy(false);
  }

  async function asGuest() {
    setBusy(true); setError(""); setNotice("");
    const problem = await signInGuest();
    if (problem) { setError(problem); setBusy(false); } else nav("/onboarding", { replace: true });
  }

  return (
    <main className="auth">
      <form className="card" onSubmit={submit}>
        <Link to="/" className="logo"><i />Orbit</Link>
        <h1 style={{ fontSize: "1.6rem" }}>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <label className="field">Email<input type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field">Password
          <span className="pw">
            <input type={show ? "text" : "password"} required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="pw-eye" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={() => setShow((v) => !v)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </span>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="notice">{notice}</p>}
        <button className="btn primary" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Sign up"}</button>
        <div className="auth-or" aria-hidden="true"><span>or</span></div>
        <button type="button" className="btn" onClick={asGuest} disabled={busy}>Continue as a guest</button>
        <p className="muted" style={{ fontSize: ".9rem" }}>
          {mode === "login" ? <>New here? <Link to="/signup" style={{ textDecoration: "underline" }}>Create an account</Link></> : <>Have an account? <Link to="/login" style={{ textDecoration: "underline" }}>Sign in</Link></>}
        </p>
        {demo && <p className="muted" style={{ fontSize: ".8rem" }}>Demo mode: accounts are saved on this device only.</p>}
      </form>
    </main>
  );
}
