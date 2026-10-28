import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../lib/auth";
import { ThemeToggleButton } from "../components/ThemeControls";
import { linkProblem } from "../lib/siteUrl";
import { checkUsername, normalizeUsername, USERNAME_MAX, usernameIsFree } from "../lib/username";

/** The liquid-metal backdrop: soft blobs of violet that drift, merge through a goo filter, and lean a little towards the pointer. */
function MercuryStage() {
  const blobs = useMemo(() => Array.from({ length: 6 }).map(() => ({
    size: Math.random() * 200 + 150, left: Math.random() * 80 + 10, top: Math.random() * 80 + 10,
    delay: Math.random() * -20, duration: Math.random() * 15 + 15,
  })), []);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const move = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth, y = e.clientY / window.innerHeight;
      refs.current.forEach((b, i) => { if (b) { const k = (i + 1) * 20; b.style.marginLeft = `${x * k}px`; b.style.marginTop = `${y * k}px`; } });
    };
    document.addEventListener("mousemove", move);
    return () => document.removeEventListener("mousemove", move);
  }, []);
  return (
    <>
      <svg className="merc-defs" aria-hidden="true" focusable="false">
        <defs>
          <filter id="merc-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>
      <div className="merc-stage" aria-hidden="true">
        {blobs.map((b, i) => (
          <div key={i} ref={(el) => { refs.current[i] = el; }} className="merc-blob" style={{ width: b.size, height: b.size, left: `${b.left}%`, top: `${b.top}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.duration}s` }} />
        ))}
      </div>
    </>
  );
}

type Availability = "idle" | "checking" | "free" | "taken" | "bad" | "unknown";

export default function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const { session, demo, signIn, signUp, signInGuest } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState(""); // an email or, when signing in, a username
  const [username, setUsername] = useState("");
  const [availability, setAvailability] = useState<Availability>("idle");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(mode === "login" ? linkProblem : "");
  const [notice, setNotice] = useState("");

  const needsUsername = mode === "signup" && !demo; // usernames need the database
  const loginByName = mode === "login" && !demo;    // so does signing in with one

  // While signing up, say right away whether the username is free.
  useEffect(() => {
    if (!needsUsername) return;
    if (!username) { setAvailability("idle"); return; }
    if (checkUsername(username)) { setAvailability("bad"); return; }
    setAvailability("checking");
    let current = true;
    const t = setTimeout(() => { void usernameIsFree(username).then((free) => { if (current) setAvailability(free === null ? "unknown" : free ? "free" : "taken"); }); }, 350);
    return () => { current = false; clearTimeout(t); };
  }, [username, needsUsername]);

  // Already signed in: the app (or onboarding, if it is not finished yet) decides where to go.
  if (session) return <Navigate to="/app" replace />;

  const hint =
    availability === "bad" ? checkUsername(username)
    : availability === "checking" ? "Checking…"
    : availability === "free" ? `@${normalizeUsername(username)} is available`
    : availability === "taken" ? "That username is taken. Try another."
    : availability === "unknown" ? "We could not check that just now. You can carry on."
    : "Friends find you with this, and you can sign in with it. Letters, numbers and underscores.";
  const hintClass = availability === "bad" || availability === "taken" ? "error" : availability === "free" ? "ok" : "muted";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(""); setNotice("");
    if (mode === "signup" && !agreed) { setError("Please agree to the Terms and Privacy Policy to make an account."); return; }
    if (needsUsername) {
      const bad = checkUsername(username);
      if (bad) { setError(bad); return; }
      if (availability === "taken") { setError("That username is taken. Try another."); return; }
    }
    setBusy(true);
    const problem = mode === "login" ? await signIn(email, password) : await signUp(email, password, needsUsername ? normalizeUsername(username) : undefined);
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
    <main className="merc">
      <MercuryStage />
      <div className="merc-theme"><ThemeToggleButton /></div>
      <form className="merc-form" onSubmit={submit}>
        <header className="merc-head">
          <Link to="/" className="merc-brand"><i aria-hidden="true" />Orbit</Link>
          <h1>{mode === "login" ? <>Welcome<br />back</> : <>Create your<br />account</>}</h1>
        </header>
        {loginByName ? (
          <label className="merc-group"><span>Email or username</span><input type="text" required autoFocus autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} /><i className="merc-glow" /></label>
        ) : (
          <label className="merc-group"><span>Email</span><input type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /><i className="merc-glow" /></label>
        )}
        {needsUsername && (
          <label className="merc-group"><span>Username</span>
            <span className="merc-at"><span aria-hidden="true">@</span>
              <input type="text" required maxLength={USERNAME_MAX} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby="auth-username-hint" value={username} onChange={(e) => setUsername(normalizeUsername(e.target.value).replace(/[^a-z0-9_]/g, ""))} />
            </span>
            <i className="merc-glow" />
            <small id="auth-username-hint" className={hintClass} role={availability === "taken" || availability === "bad" ? "alert" : undefined}>{hint}</small>
          </label>
        )}
        <label className="merc-group"><span>Password</span>
          <span className="pw">
            <input type={show ? "text" : "password"} required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="pw-eye" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={() => setShow((v) => !v)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </span>
          <i className="merc-glow" />
        </label>
        {mode === "login" && !demo && <p className="merc-forgot"><Link to="/forgot">Forgot password?</Link></p>}
        {mode === "signup" && (
          <label className="auth-agree">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>I agree to the <Link to="/terms" target="_blank" rel="noreferrer">Terms</Link> and <Link to="/privacy" target="_blank" rel="noreferrer">Privacy Policy</Link>.</span>
          </label>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="notice">{notice}</p>}
        <div className="merc-submit">
          <span className="merc-goo" aria-hidden="true"><i className="merc-base" /><i className="merc-drop" /></span>
          <button className="merc-btn" disabled={busy || (needsUsername && availability === "checking")}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Sign up"}</button>
        </div>
        <button type="button" className="merc-guest" onClick={asGuest} disabled={busy}>Continue as a guest</button>
        <p className="merc-foot">
          {mode === "login" ? <>New here? <Link to="/signup">Create an account</Link></> : <>Have an account? <Link to="/login">Sign in</Link></>}
        </p>
        <p className="merc-fine">By continuing you agree to the <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.{demo && " Demo mode: accounts are saved on this device only."}</p>
      </form>
    </main>
  );
}
