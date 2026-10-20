import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

export default function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const { session, configured } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (session) return <Navigate to="/app" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(""); setNotice("");
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message); else nav("/app");
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/login` } });
      if (error) setError(error.message);
      else setNotice("Check your email to confirm your account, then sign in.");
    }
    setBusy(false);
  }

  return (
    <main className="auth">
      <form className="card" onSubmit={submit}>
        <Link to="/" className="logo"><i />Orbit</Link>
        <h1 style={{ fontSize: "1.6rem" }}>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        {!configured && <p className="error">Supabase isn’t configured. Copy .env.example to .env.local and add your project URL and publishable key.</p>}
        <label className="field">Email<input type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field">Password
          <span className="pw">
            <input type={show ? "text" : "password"} required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="pw-eye" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={() => setShow((v) => !v)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </span>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="notice">{notice}</p>}
        <button className="btn primary" disabled={busy || !configured}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Sign up"}</button>
        <p className="muted" style={{ fontSize: ".9rem" }}>
          {mode === "login" ? <>New here? <Link to="/signup" style={{ textDecoration: "underline" }}>Create an account</Link></> : <>Have an account? <Link to="/login" style={{ textDecoration: "underline" }}>Sign in</Link></>}
        </p>
      </form>
    </main>
  );
}
