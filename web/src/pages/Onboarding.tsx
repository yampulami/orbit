import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Building2, Bus, Check, Home, Sofa } from "lucide-react";
import CampusSearch from "../components/CampusSearch";
import SetupPreview from "../components/SetupPreview";
import { useAuth } from "../lib/auth";
import { demoAuth, isGuestEmail } from "../lib/demoAuth";
import { arrival } from "../lib/arrival";
import { checkUsername, normalizeUsername, suggestUsername, usernameIsFree } from "../lib/username";
import { feedApi } from "../lib/feedData";
import { resetCampus } from "../lib/campus";
import { pushProfile, saveProfile, type Living, type Profile, type Tenure } from "../lib/profile";
import { progress } from "../lib/progress";
import { supabase } from "../lib/supabase";
import { useThemePref } from "../lib/theme";
import { campusKey, validCampus } from "../shared/campus";
import type { University } from "../lib/universities";

const TENURES: { id: Tenure; label: string }[] = [
  { id: "first-semester", label: "My first semester" },
  { id: "first-year", label: "First year" },
  { id: "second-year", label: "Second year" },
  { id: "third-year", label: "Third year" },
  { id: "fourth-plus", label: "Fourth year or longer" },
  { id: "graduate", label: "Graduate student" },
];
const LIVING: { id: Living; label: string; hint: string; icon: typeof Home }[] = [
  { id: "residence", label: "On campus", hint: "In a residence hall", icon: Building2 },
  { id: "commute", label: "I commute", hint: "Car, bus or train", icon: Bus },
  { id: "off-campus", label: "Off campus", hint: "With roommates", icon: Sofa },
  { id: "other", label: "Somewhere else", hint: "Home, or it is complicated", icon: Home },
];
const INTERESTS = ["Events", "Meeting people", "Finding roommates", "Buying and selling", "Study groups", "Campus help"];

type Step = "campus" | "you" | "life" | "interests";
const STEPS: Step[] = ["campus", "you", "life", "interests"];

/** First-time setup: four short screens between signing in and the app. Your university first (everything in the app is limited to it), then your name
 *  and username, then how long you have been there and where you live, then what you are here for (optional). Everything else that used to be asked here
 *  (streaks, alerts, theme, bio and hobbies) starts at a sensible default and lives in Profile. Nothing animates except a quick fade between screens. */
export default function Onboarding() {
  const { session, demo, signOut, refresh } = useAuth();
  const nav = useNavigate();
  const look = useThemePref();
  const [i, setI] = useState(0);
  const [uni, setUni] = useState<University | null>(null);
  const [name, setName] = useState("");
  // The username picked at sign up (kept with the account) is the starting point; guests and older accounts get one suggested from their name.
  const chosenAtSignUp = (session?.user.user_metadata as { username?: string } | undefined)?.username ?? "";
  const [username, setUsername] = useState(chosenAtSignUp);
  const [userEdited, setUserEdited] = useState(!!chosenAtSignUp);
  const [tenure, setTenure] = useState<Tenure | "">("");
  const [living, setLiving] = useState<Living | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Say whether the username is free as it is typed (the same check the sign up form uses), so a taken one is never carried to the end.
  const [availability, setAvailability] = useState<"idle" | "bad" | "checking" | "free" | "taken" | "unknown">("idle");
  useEffect(() => {
    if (!supabase) return;
    if (!username) { setAvailability("idle"); return; }
    if (checkUsername(username)) { setAvailability("bad"); return; }
    setAvailability("checking");
    let current = true;
    const t = setTimeout(() => { void usernameIsFree(username).then((free) => { if (current) setAvailability(free === null ? "unknown" : free ? "free" : "taken"); }); }, 350);
    return () => { current = false; clearTimeout(t); };
  }, [username]);
  useEffect(() => { if (supabase && !userEdited) setUsername(suggestUsername(name.trim().split(" ")[0] ?? "")); }, [name, userEdited]);

  const meta = session?.user.user_metadata as { name?: string } | undefined;
  // A name to start from, unless this is a guest: they type their own.
  useEffect(() => {
    const email = session?.user.email;
    if (isGuestEmail(email) || !email || meta?.name === "Guest") return;
    setName((n) => n || meta?.name || email.split("@")[0]);
  }, [meta?.name, session?.user.email]);

  if (!session) return <Navigate to="/login" replace />;

  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const can: Record<Step, boolean> = {
    campus: !!uni && validCampus(uni.name),
    you: name.trim().length >= 1 && (!supabase || (!checkUsername(username) && availability !== "checking" && availability !== "taken")),
    life: !!tenure && !!living,
    interests: true,
  };
  const go = (n: number) => { setI(n); setError(""); };

  async function finish() {
    if (!uni || !tenure || !living) return;
    setSaving(true); setError("");
    arrival.start();
    try {
      const key = campusKey(uni.name);
      const profile: Profile = {
        name: name.trim(), username: supabase ? normalizeUsername(username) : undefined, campusName: uni.name.trim(), campusKey: key, campusDomain: uni.domain || undefined,
        tenure, living, interests, streaks: false, nudges: { hangouts: true, reminders: true, places: true }, look, doneAt: new Date().toISOString(),
      };
      await feedApi.join({ name: profile.campusName, key }, session!.user.id);
      if (supabase) await supabase.auth.updateUser({ data: { name: profile.name } }); else demoAuth.setName(session!.user.id, profile.name);
      await pushProfile(session!.user.id, profile); // the membership above has to exist first
      saveProfile(session!.user.id, profile);
      progress.setEnabled(false);
      resetCampus();
      refresh();
      nav("/app", { replace: true });
    } catch (e) {
      arrival.end();
      const message = (e as Error).message || "";
      if (/username/i.test(message)) { setI(STEPS.indexOf("you")); setError("That username is taken. Pick another."); }
      else setError(message || "Something went wrong saving your answers. Try again.");
      setSaving(false);
    }
  }
  const next = () => { if (!can[step] || saving) return; if (last) void finish(); else go(i + 1); };
  const toggleInterest = (t: string) => setInterests((l) => (l.includes(t) ? l.filter((x) => x !== t) : [...l, t]));

  const title: Record<Step, string> = { campus: "Which campus is yours?", you: "What should we call you?", life: "A little about your life on campus", interests: "What are you here for?" };
  const sub: Record<Step, string> = {
    campus: "Your feed, events and map are just for your university. Start typing its name.",
    you: "This is what other students on your campus will see.",
    life: "It helps us show you the right things, and it is never shown to anyone else.",
    interests: "Pick any that fit, or skip this one. You can change everything else later in Profile.",
  };

  const body: Record<Step, ReactNode> = {
    campus: <CampusSearch value={uni} onPick={setUni} autoFocus />,
    you: (
      <>
        <label className="field"><span className="onb-label">First name</span><input className="onb-input" value={name} maxLength={40} autoFocus autoComplete="given-name" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") next(); }} placeholder="Your first name" /></label>
        {supabase && (
          <label className="field onb-username"><span className="onb-label">Username</span>
            <span className="onb-at"><span aria-hidden="true">@</span><input className="onb-input" value={username} maxLength={20} autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby="onb-username-help" onChange={(e) => { setUserEdited(true); setUsername(normalizeUsername(e.target.value).replace(/[^a-z0-9_]/g, "")); }} onKeyDown={(e) => { if (e.key === "Enter") next(); }} placeholder="username" /></span>
            <small id="onb-username-help" className={availability === "bad" || availability === "taken" ? "error" : availability === "free" ? "ok" : "muted"} role={availability === "taken" || availability === "bad" ? "alert" : undefined}>
              {availability === "bad" ? checkUsername(username) : availability === "checking" ? "Checking…" : availability === "free" ? `@${normalizeUsername(username)} is available` : availability === "taken" ? "That username is taken. Try another." : availability === "unknown" ? "We could not check that just now. You can carry on." : "Friends find you and add you to groups with this. Letters, numbers and underscores."}
            </small>
          </label>
        )}
      </>
    ),
    life: (
      <>
        <label className="field"><span className="onb-label">How long have you been on campus?</span>
          <select className="onb-input" value={tenure} onChange={(e) => setTenure(e.target.value as Tenure)}>
            <option value="" disabled>Choose one</option>
            {TENURES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <div className="field">
          <span className="onb-label" id="onb-live">Where do you live?</span>
          <div className="onb-choices two" role="radiogroup" aria-labelledby="onb-live">
            {LIVING.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={living === l.id} className="onb-choice" onClick={() => setLiving(l.id)}>
                <span className="onb-choice-ico"><l.icon size={20} aria-hidden="true" /></span>
                <span className="onb-choice-text"><strong>{l.label}</strong><em>{l.hint}</em></span>
                <span className="onb-check" aria-hidden="true">{living === l.id && <Check size={16} strokeWidth={3} />}</span>
              </button>
            ))}
          </div>
        </div>
      </>
    ),
    interests: (
      <div className="onb-chips" role="group" aria-label="What you are here for">
        {INTERESTS.map((t) => {
          const on = interests.includes(t);
          return <button key={t} type="button" aria-pressed={on} onClick={() => toggleInterest(t)}>{on && <Check size={14} aria-hidden="true" />}{t}</button>;
        })}
      </div>
    ),
  };

  return (
    <main className="onb calm">
      <header className="onb-top">
        <Link to="/" className="logo" aria-label="Orbit"><i />Orbit</Link>
        <p className="onb-steps" aria-label={`Step ${i + 1} of ${STEPS.length}`}>Step {i + 1} of {STEPS.length}</p>
        <button type="button" className="onb-out" onClick={async () => { await signOut(); nav("/login", { replace: true }); }}>Sign out</button>
      </header>
      <div className="onb-bar" aria-hidden="true">{STEPS.map((s, n) => <span key={s} className={n <= i ? "on" : ""} />)}</div>
      <div className="onb-stage two">
        <div className="onb-panel">
          <div key={step} className="onb-step onb-fade">
            <h1>{title[step]}</h1>
            <p className="onb-sub">{sub[step]}</p>
            <div className="onb-body">{body[step]}</div>
            {error && <p className="error" role="alert">{error}</p>}
            <div className="onb-actions">
              {i > 0 && <button type="button" className="onb-back" onClick={() => go(i - 1)} aria-label="Back" disabled={saving}><ArrowLeft size={18} aria-hidden="true" /></button>}
              <button type="button" className="btn primary onb-next" disabled={!can[step] || saving} onClick={next}>
                <span>{saving ? "Setting up…" : last ? (interests.length === 0 ? "Skip and take me in" : "Take me in") : "Continue"}</span>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
        <SetupPreview step={step} uni={uni} name={name} username={supabase ? normalizeUsername(username) : ""} tenure={tenure} living={living} interests={interests} />
      </div>
      {demo && <p className="onb-demo">Demo mode: your answers are saved on this device.</p>}
    </main>
  );
}
