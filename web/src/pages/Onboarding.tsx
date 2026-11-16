import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Moon, Monitor, Sun } from "lucide-react";
import PasswordStrength from "../components/PasswordStrength";
import CampusSearch from "../components/CampusSearch";
import Stage, { useOmega, type Avail, type PageId } from "../components/onboarding/Stage";
import { burst } from "../components/onboarding/burst";
import { useAuth } from "../lib/auth";
import { demoAuth, isGuestEmail } from "../lib/demoAuth";
import { arrival } from "../lib/arrival";
import { loadSnapshot, snapshotLine } from "../lib/campusSnapshot";
import { checkUsername, normalizeUsername, suggestUsername, usernameIsFree } from "../lib/username";
import { feedApi } from "../lib/feedData";
import { resetCampus } from "../lib/campus";
import { deviceAlertsOn, deviceSupported, enableDeviceAlerts } from "../lib/deviceAlerts";
import { pushProfile, saveProfile, type Living, type Profile, type Tenure } from "../lib/profile";
import { progress } from "../lib/progress";
import { supabase } from "../lib/supabase";
import { useCooldown } from "../lib/cooldown";
import { resendConfirmation } from "../lib/confirmEmail";
import { clearDraft, complete, loadDraft, saveDraft } from "../lib/setupDraft";
import { setThemePref, useThemePref, type ThemePref } from "../lib/theme";
import { campusKey, validCampus } from "../shared/campus";
import { type University } from "../lib/universities";

const TENURES: { id: Tenure; label: string }[] = [
  { id: "first-semester", label: "My first semester" },
  { id: "first-year", label: "First year" },
  { id: "second-year", label: "Second year" },
  { id: "third-year", label: "Third year" },
  { id: "fourth-plus", label: "Fourth year or longer" },
  { id: "graduate", label: "Graduate student" },
];
const LIVING: { id: Living; label: string; hint: string; pic: string; alt: string }[] = [
  { id: "residence", label: "On campus", hint: "In a residence hall", pic: "home-residence", alt: "Omega waving beside a residence hall, with a backpack" },
  { id: "commute", label: "I commute", hint: "Car, bus or train", pic: "home-commute", alt: "Omega riding in a small open car" },
  { id: "off-campus", label: "Off campus", hint: "With roommates", pic: "home-offcampus", alt: "Omega beside a house with moving boxes" },
  { id: "other", label: "Somewhere else", hint: "Home, or it is complicated", pic: "home-other", alt: "Omega standing on a map next to a pin" },
];
const INTERESTS = ["Events", "Meeting people", "Finding roommates", "Buying and selling", "Study groups", "Campus help"];
const NUDGES: { key: "hangouts" | "reminders" | "places"; title: string; hint: string }[] = [
  { key: "hangouts", title: "Hangouts", hint: "When friends want to meet up" },
  { key: "reminders", title: "Reminders", hint: "Things you asked to be reminded about" },
  { key: "places", title: "Places", hint: "Good spots that are open near you" },
];
const LOOKS: { id: ThemePref; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "Match my device", icon: Monitor },
];
const TITLES: Record<PageId, [string, string]> = {
  campus: ["Which campus is yours?", "Your feed, events and map are just for your university. Start typing its name."],
  you: ["What should we call you?", "This is what other students on your campus will see."],
  life: ["A little about your life on campus", "It helps us show you the right things, and it is never shown to anyone else."],
  interests: ["What are you here for?", "Pick any that fit, or skip this one. You can change everything else later in Profile."],
  alerts: ["Want a nudge now and then?", "Orbit only speaks up about things you care about. You can change this any time in Profile."],
  look: ["How should Orbit look?", "Pick one. You can switch whenever you like, from the menu."],
  account: ["Save your spot", "Make an account so your setup is kept. Your email is only used to confirm it and to reset your password."],
  done: ["", ""],
};

/** With no account yet (the usual way in) there is one more page, before the last: making the account. Someone who already has one skips it. */
const STEPS_BASE: PageId[] = ["campus", "you", "life", "interests", "alerts", "look", "done"];
const STEPS_NEW: PageId[] = ["campus", "you", "life", "interests", "alerts", "look", "account", "done"];
const first = (n: string) => n.trim().split(" ")[0] ?? "";
type Nudges = { hangouts: boolean; reminders: boolean; places: boolean };

/** First-time setup, seven short pages. The progress bar at the top has Omega on it: a tiny figure who walks to each step as you reach it (see
 *  components/onboarding/bar.ts). Everything the old four screens asked for is still asked; the alerts and look pages used to be defaults that lived in Profile. */
export default function Onboarding() {
  const { session, demo, signOut, refresh, signUp } = useAuth();
  const nav = useNavigate();
  const lookPref = useThemePref();
  // Setup comes first and the account after it. The list of pages is settled when setup opens, so it does not shift when the account gets made.
  const [steps] = useState<PageId[]>(() => (session ? STEPS_BASE : STEPS_NEW));
  const [draft] = useState(() => loadDraft(!!session));
  const accountAt = steps.indexOf("account");
  const [i, setI] = useState(() => {
    if (!draft) return 0;
    if (session) return complete(draft) ? steps.length - 1 : Math.min(draft.step, steps.length - 2); // back from the inbox: straight to the last page
    return Math.max(0, Math.min(draft.step, accountAt));
  });
  const [uni, setUni] = useState<University | null>(draft?.uni ?? null);
  const [name, setName] = useState(draft?.name ?? "");
  const chosenAtSignUp = (session?.user.user_metadata as { username?: string } | undefined)?.username ?? "";
  const [username, setUsername] = useState(chosenAtSignUp || draft?.username || "");
  const [userEdited, setUserEdited] = useState(!!(chosenAtSignUp || draft?.username));
  const [tenure, setTenure] = useState<Tenure | "">(draft?.tenure ?? "");
  const [living, setLiving] = useState<Living | null>(draft?.living ?? null);
  const [interests, setInterests] = useState<string[]>(draft?.interests ?? []);
  const [nudges, setNudges] = useState<Nudges>(draft?.nudges ?? { hangouts: true, reminders: true, places: true });
  // the account page
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [making, setMaking] = useState(false);
  const [sent, setSent] = useState(""); // the address a confirmation link went to, while we wait for it
  const [resending, setResending] = useState(false);
  const wait = useCooldown("signup:" + email.trim().toLowerCase());
  const [device, setDevice] = useState(deviceAlertsOn());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [availability, setAvailability] = useState<Avail>("idle");
  const [snap, setSnap] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    if (!username) { setAvailability("idle"); return; }
    if (checkUsername(username)) { setAvailability("bad"); return; }
    setAvailability("checking");
    let current = true;
    const t = setTimeout(() => { void usernameIsFree(username).then((free) => { if (current) setAvailability(free === null ? "unknown" : free ? "free" : "taken"); }); }, 350);
    return () => { current = false; clearTimeout(t); };
  }, [username]);
  useEffect(() => { if (supabase && !userEdited) setUsername(suggestUsername(first(name))); }, [name, userEdited]);
  useEffect(() => {
    if (!uni) { setSnap(null); return; }
    let current = true;
    void loadSnapshot(campusKey(uni.name)).then((s) => { if (current) setSnap(snapshotLine(s)); });
    return () => { current = false; };
  }, [uni]);

  // one burst of confetti when you get to the end: the one big moment
  useEffect(() => {
    if (steps[i] !== "done") return;
    const t = window.setTimeout(() => {
      const w = window.innerWidth, c = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff7a45", all = [c, c, "#ffffff"];
      [0.28, 0.5, 0.72].forEach((f, n) => window.setTimeout(() => burst(w * f, window.innerHeight * 0.34, all, 26, 1.6), n * 160));
    }, 450);
    return () => window.clearTimeout(t);
  }, [i]);

  const meta = session?.user.user_metadata as { name?: string } | undefined;
  useEffect(() => {
    const email = session?.user.email;
    if (isGuestEmail(email) || !email || meta?.name === "Guest") return;
    setName((n) => n || meta?.name || email.split("@")[0]);
  }, [meta?.name, session?.user.email]);

  // keep the answers on this device as they are given (see lib/setupDraft.ts)
  useEffect(() => {
    if (!uni && !name) return;
    saveDraft({ step: i, uni, name, username, tenure, living, interests, nudges });
  }, [i, uni, name, username, tenure, living, interests, nudges]);
  // the account got made (it signs in at once when there is nothing to confirm): on to the last page
  useEffect(() => { if (session && steps[i] === "account") { setSent(""); setI(steps.length - 1); } }, [session, steps, i]);

  const step = steps[i];
  const last = i === steps.length - 1;
  const can: Record<PageId, boolean> = {
    campus: !!uni && validCampus(uni.name),
    you: name.trim().length >= 1 && (!supabase || (!checkUsername(username) && availability !== "checking" && availability !== "taken")),
    life: !!tenure && !!living,
    interests: true,
    alerts: true,
    look: true,
    account: /^\S+@\S+\.\S+$/.test(email.trim()) && password.length >= 8 && agreed && !making && !sent,
    done: !!uni && !!tenure && !!living && !!session,
  };
  const go = (n: number) => { setI(n); setError(""); };

  async function createAccount() {
    if (!can.account) return;
    setMaking(true); setError("");
    const problem = await signUp(email.trim(), password, supabase ? normalizeUsername(username) : undefined);
    setMaking(false);
    if (problem) {
      if (/username/i.test(problem)) { setI(steps.indexOf("you")); setError("That username is taken. Pick another."); } else setError(problem);
      return;
    }
    if (supabase) { setSent(email.trim()); wait.start(); } // no session yet: the link in the email comes first. With none needed the effect above moves on.
  }
  async function sendAgain() {
    if (resending || wait.left > 0) return;
    setResending(true); setError("");
    const problem = await resendConfirmation(sent);
    setResending(false);
    if (problem) setError(problem); else wait.start();
  }

  async function finish() {
    if (!uni || !tenure || !living || !session) return;
    setSaving(true); setError("");
    arrival.start();
    try {
      const key = campusKey(uni.name);
      const profile: Profile = {
        name: name.trim(), username: supabase ? normalizeUsername(username) : undefined, campusName: uni.name.trim(), campusKey: key, campusDomain: uni.domain || undefined,
        tenure, living, interests, streaks: false, nudges, look: lookPref, doneAt: new Date().toISOString(),
      };
      await feedApi.join({ name: profile.campusName, key }, session!.user.id);
      if (supabase) await supabase.auth.updateUser({ data: { name: profile.name } }); else demoAuth.setName(session!.user.id, profile.name);
      await pushProfile(session!.user.id, profile); // the membership above has to exist first
      saveProfile(session!.user.id, profile);
      clearDraft();
      progress.setEnabled(false);
      resetCampus();
      refresh();
      nav("/app", { replace: true });
    } catch (e) {
      arrival.end();
      const message = (e as Error).message || "";
      if (/username/i.test(message)) { setI(steps.indexOf("you")); setError("That username is taken. Pick another."); }
      else setError(message || "Something went wrong saving your answers. Try again.");
      setSaving(false);
    }
  }
  const next = () => { if (!can[step] || saving) return; if (step === "account") void createAccount(); else if (last) void finish(); else go(i + 1); };

  const [title, sub] = step === "done" ? [`You're in, ${first(name) || "friend"}.`, `${uni?.name ?? "Your campus"} is set up the way you said.`] : TITLES[step];

  return (
    <Stage index={i} count={steps.length} page={step}>
      <div className="ob-sticky">
      <header className="ob-top">
        <Link to="/" className="logo" aria-label="Orbit"><i />Orbit</Link>
        <p className="ob-steps" aria-label={`Step ${i + 1} of ${steps.length}`}>Step {i + 1} of {steps.length}</p>
        {session
          ? <button type="button" className="onb-out" onClick={async () => { await signOut(); nav("/login", { replace: true }); }}>Sign out</button>
          : <Link to="/login" className="onb-out">Sign in</Link>}
      </header>
      <div className={"ob-bar" + (saving ? " saving" : "")} aria-hidden="true">{steps.map((s, n) => <span key={s} style={{ "--i": n } as CSSProperties} className={n < i ? "done" : n === i ? "cur" : ""} />)}</div>
      </div>
      <Signals step={step} ok={can[step]} taken={availability === "taken"} />
      <div className={"ob-main" + (step === "life" ? " wide" : "")} key={step}>
        <div className="ob-head"><h1>{title}</h1><p>{sub}</p></div>
        <Pages step={step} next={next}
          st={{ uni, setUni, snap, name, setName, username, setUsername, setUserEdited, availability, tenure, setTenure, living, setLiving, interests, setInterests, nudges, setNudges, device, setDevice, lookPref, error,
            acct: { email, setEmail, password, setPassword, showPw, setShowPw, agreed, setAgreed, making, sent, left: wait.left, resending, sendAgain, changeEmail: () => { setSent(""); setError(""); } } }} />
        <Actions i={i} last={last} can={can[step]} saving={saving || making} label={step === "account" ? (making ? "Making your account…" : "Create account") : undefined} hideNext={step === "account" && !!sent} back={() => go(i - 1)} next={next} />
      </div>
      {demo && <p className="onb-demo">Demo mode: your answers are saved on this device.</p>}
    </Stage>
  );
}

type St = {
  uni: University | null; setUni: (u: University | null) => void; snap: string | null;
  name: string; setName: (v: string) => void; username: string; setUsername: (v: string) => void; setUserEdited: (v: boolean) => void; availability: Avail;
  tenure: Tenure | ""; setTenure: (t: Tenure) => void; living: Living | null; setLiving: (l: Living) => void;
  interests: string[]; setInterests: (f: (l: string[]) => string[]) => void;
  nudges: Nudges; setNudges: (f: (n: Nudges) => Nudges) => void;
  device: boolean; setDevice: (v: boolean) => void; lookPref: ThemePref; error: string;
  acct: {
    email: string; setEmail: (v: string) => void; password: string; setPassword: (v: string) => void; showPw: boolean; setShowPw: (f: (v: boolean) => boolean) => void;
    agreed: boolean; setAgreed: (v: boolean) => void; making: boolean; sent: string; left: number; resending: boolean; sendAgain: () => void; changeEmail: () => void;
  };
};

/** Tells Omega when the answer on this page becomes good (he smiles) and when the username is taken (he shakes his head). Renders nothing. */
function Signals({ step, ok, taken }: { step: PageId; ok: boolean; taken: boolean }) {
  const { emit } = useOmega();
  const was = useRef<{ step: PageId; ok: boolean }>({ step, ok });
  useEffect(() => {
    const prev = was.current;
    was.current = { step, ok };
    if (prev.step === step && !prev.ok && ok && step !== "done" && ["campus", "you", "life"].includes(step)) emit("valid");
  }, [step, ok, emit]);
  useEffect(() => { if (taken) emit("rejected"); }, [taken, emit]);
  return null;
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={"ob-card " + className}>{children}</div>;
}

function Actions({ i, last, can, saving, label, hideNext, back, next }: { i: number; last: boolean; can: boolean; saving: boolean; label?: string; hideNext?: boolean; back: () => void; next: () => void }) {
  const { emit } = useOmega();
  return (
    <div className="ob-act">
      {i > 0 && <button type="button" className="ob-back" onClick={back} aria-label="Back" disabled={saving}><ArrowLeft size={18} aria-hidden="true" /></button>}
      {!hideNext && (
        <button type="button" className="btn primary ob-next" disabled={!can || saving} onClick={() => { if (last) emit("finish"); next(); }}>
          <span>{label ?? (saving ? "Setting up…" : last ? "Take me in" : "Continue")}</span><ArrowRight size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function Pages({ step, st, next }: { step: PageId; st: St; next: () => void }) {
  const { emit } = useOmega();
  const key = (e: React.KeyboardEvent) => { if (e.key === "Enter") next(); };
  const nudgeCount = Object.values(st.nudges).filter(Boolean).length;

  switch (step) {
    case "campus":
      return (
        <Card>
          <span className="ob-label">Your university</span>
          <CampusSearch value={st.uni} onPick={(u) => { st.setUni(u); if (u) { emit("choose"); window.setTimeout(() => document.querySelector<HTMLElement>(".ob-next")?.focus(), 90); /* so Enter again goes on */ } }} autoFocus />
          {st.uni && st.snap && <p className="ob-note ok">{st.snap}</p>}
        </Card>
      );
    case "you":
      return (
        <>
          <Card>
            <label className="ob-label" htmlFor="ob-name">First name</label>
            <input id="ob-name" className="ob-input" value={st.name} maxLength={40} autoFocus autoComplete="given-name" onChange={(e) => st.setName(e.target.value)} onKeyDown={key} placeholder="Your first name" />
          </Card>
          {supabase && (
            <Card>
              <label className="ob-label" htmlFor="ob-user">Username</label>
              <span className="ob-at"><span aria-hidden="true">@</span>
                <input id="ob-user" value={st.username} maxLength={20} autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby="ob-user-help"
                  onChange={(e) => { st.setUserEdited(true); st.setUsername(normalizeUsername(e.target.value).replace(/[^a-z0-9_]/g, "")); }} onKeyDown={key} placeholder="username" />
              </span>
              <p id="ob-user-help" className={"ob-note " + (st.availability === "bad" || st.availability === "taken" ? "error" : st.availability === "free" ? "ok" : "")} role={st.availability === "taken" || st.availability === "bad" ? "alert" : undefined}>
                {st.availability === "bad" ? checkUsername(st.username) : st.availability === "checking" ? "Checking…" : st.availability === "free" ? `@${normalizeUsername(st.username)} is available` : st.availability === "taken" ? "That username is taken. Try another." : st.availability === "unknown" ? "We could not check that just now. You can carry on." : "Friends find you and add you to groups with this. Letters, numbers and underscores."}
              </p>
            </Card>
          )}
        </>
      );
    case "life":
      return (
        <>
          <Card>
            <span className="ob-label" id="ob-tenure">How long have you been on campus?</span>
            <div className="ob-opts" role="radiogroup" aria-labelledby="ob-tenure">
              {TENURES.map((t) => (
                <button key={t.id} type="button" role="radio" aria-checked={st.tenure === t.id} className="ob-opt" onClick={() => { st.setTenure(t.id); emit("choose"); }}>
                  <Check size={14} className="ob-tick" aria-hidden="true" />{t.label}
                </button>
              ))}
            </div>
          </Card>
          <div className="ob-homes" role="radiogroup" aria-label="Where do you live?">
            {LIVING.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={st.living === l.id} className="ob-card ob-home" onClick={() => { st.setLiving(l.id); emit("choose"); }}>
                <img className="pic" src={`/cards/${l.pic}.webp`} alt="" width={1015} height={667} loading="lazy" decoding="async" /><strong>{l.label}</strong><em>{l.hint}</em>
              </button>
            ))}
          </div>
        </>
      );
    case "interests":
      return (
        <Card>
          <div className="ob-opts">
            {INTERESTS.map((t) => {
              const on = st.interests.includes(t);
              return (
                <button key={t} type="button" aria-pressed={on} className="ob-opt" onClick={() => { st.setInterests((l) => (on ? l.filter((x) => x !== t) : [...l, t])); emit("toggle"); }}>
                  {on && <Check size={14} aria-hidden="true" />}{t}
                </button>
              );
            })}
          </div>
        </Card>
      );
    case "alerts":
      return (
        <Card>
          {NUDGES.map((n) => (
            <button key={n.key} type="button" className="ob-switch" aria-pressed={st.nudges[n.key]} onClick={() => { const on = !st.nudges[n.key]; st.setNudges((v) => ({ ...v, [n.key]: on })); emit("toggle"); }}>
              <span><strong>{n.title}</strong><em>{n.hint}</em></span><i aria-hidden="true" />
            </button>
          ))}
          {deviceSupported() && (
            <button type="button" className="btn ob-device" disabled={st.device}
              onClick={async () => { const p = await enableDeviceAlerts(); st.setDevice(p === "granted"); if (p === "granted") emit("device"); }}>
              {st.device ? "Device alerts are on" : "Allow alerts on this device"}
            </button>
          )}
        </Card>
      );
    case "look":
      return (
        <div className="ob-looks" role="radiogroup" aria-label="Appearance">
          {LOOKS.map((l) => (
            <button key={l.id} type="button" role="radio" aria-checked={st.lookPref === l.id} className="ob-card ob-theme" onClick={() => { setThemePref(l.id); emit("theme", { dark: l.id === "dark" || (l.id === "system" && matchMedia("(prefers-color-scheme: dark)").matches) }); }}>
              <span className="swatch" style={{ background: l.id === "light" ? "#f1f2ee" : l.id === "dark" ? "#131513" : "linear-gradient(90deg,#f1f2ee 50%,#131513 50%)", color: l.id === "light" ? "#131513" : "#f1f2ee" }}><l.icon size={22} aria-hidden="true" /></span>
              <strong>{l.label}</strong>
            </button>
          ))}
        </div>
      );
    case "account": {
      const a = st.acct;
      if (a.sent) {
        return (
          <Card>
            <p className="ob-note ok" role="status">We emailed a link to {a.sent}. Open it and press the button to confirm. It can take a few minutes, so check your spam folder too. Your answers are saved here, and you will pick up at the last page.</p>
            {st.error && <p className="ob-note error" role="alert">{st.error}</p>}
            <button type="button" className="btn" disabled={a.resending || a.left > 0} onClick={a.sendAgain}>{a.resending ? "Sending…" : a.left > 0 ? `Send it again (wait ${a.left}s)` : "Send it again"}</button>
            <button type="button" className="btn" onClick={a.changeEmail}>Wrong address? Change it</button>
          </Card>
        );
      }
      return (
        <>
          <Card>
            <label className="ob-label" htmlFor="ob-email">Email</label>
            <input id="ob-email" className="ob-input" type="email" value={a.email} autoFocus autoComplete="email" onChange={(e) => a.setEmail(e.target.value)} onKeyDown={key} placeholder="you@university.edu" />
          </Card>
          <Card>
            <label className="ob-label" htmlFor="ob-pass">Password</label>
            <span className="pwfield">
              <input id="ob-pass" className="ob-input" type={a.showPw ? "text" : "password"} value={a.password} minLength={8} autoComplete="new-password" onChange={(e) => a.setPassword(e.target.value)} onKeyDown={key} placeholder="At least 8 characters" />
              <button type="button" className="pw-eye" aria-label={a.showPw ? "Hide password" : "Show password"} aria-pressed={a.showPw} onClick={() => a.setShowPw((v) => !v)}>{a.showPw ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </span>
            {a.password && <PasswordStrength value={a.password} />}
          </Card>
          <label className="auth-agree">
            <input type="checkbox" checked={a.agreed} onChange={(e) => a.setAgreed(e.target.checked)} />
            <span>I agree to the <Link to="/terms" target="_blank" rel="noreferrer">Terms</Link> and <Link to="/privacy" target="_blank" rel="noreferrer">Privacy Policy</Link>.</span>
          </label>
          {st.error && <p className="ob-note error" role="alert">{st.error}</p>}
        </>
      );
    }
    case "done":
      return (
        <Card>
          <dl className="ob-sum">
            <div><dt>Campus</dt><dd>{st.uni?.name ?? "—"}</dd></div>
            <div><dt>Name</dt><dd>{first(st.name) || "—"}</dd></div>
            {supabase && <div><dt>Username</dt><dd>@{normalizeUsername(st.username)}</dd></div>}
            <div><dt>Home</dt><dd>{LIVING.find((l) => l.id === st.living)?.label ?? "—"}</dd></div>
            <div><dt>Nudges</dt><dd>{nudgeCount === 0 ? "None" : `${nudgeCount} of 3 on`}</dd></div>
          </dl>
          {st.error && <p className="ob-note error" role="alert">{st.error}</p>}
        </Card>
      );
  }
}
