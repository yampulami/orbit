import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { ArrowLeft, ArrowRight, Bell, Building2, Bus, Check, Home, Moon, Monitor, Sofa, Sun } from "lucide-react";
import CampusSearch from "../components/CampusSearch";
import OrbitArt from "../components/OrbitArt";
import { useAuth } from "../lib/auth";
import { demoAuth, isGuestEmail } from "../lib/demoAuth";
import { pushSupported } from "../lib/push";
import { arrival } from "../lib/arrival";
import { checkUsername, normalizeUsername, suggestUsername } from "../lib/username";
import { deviceSupported, disableDeviceAlerts, enableDeviceAlerts, useDeviceAlerts } from "../lib/deviceAlerts";
import { notice } from "../lib/notice";
import { feedApi } from "../lib/feedData";
import { resetCampus } from "../lib/campus";
import { pushProfile, saveProfile, TENURE_YEARS, type Living, type Look, type Profile, type Tenure } from "../lib/profile";
import { progress } from "../lib/progress";
import { BIO_MAX, HOBBY_IDEAS, HOBBY_LEN, HOBBY_MAX, bioLength, cleanHobbies, saveAbout } from "../lib/about";
import EmojiButton from "../components/EmojiButton";
import { supabase } from "../lib/supabase";
import { setThemePref, useThemePref } from "../lib/theme";
import { campusKey, validCampus } from "../shared/campus";
import type { University } from "../lib/universities";
import { enter, exit } from "../lib/motion";

const spring = { type: "spring" as const, stiffness: 520, damping: 30 };
const soft = { type: "spring" as const, stiffness: 300, damping: 24 };
const CONFETTI = ["var(--pink)", "var(--peach)", "var(--mint)", "var(--lav)", "var(--butter)"];

const TENURES: { id: Tenure; label: string; hint: string }[] = [
  { id: "first-semester", label: "My first semester", hint: "Everything is new" },
  { id: "first-year", label: "First year", hint: "Finding your way around" },
  { id: "second-year", label: "Second year", hint: "You know the good spots" },
  { id: "third-year", label: "Third year", hint: "You could give the tour" },
  { id: "fourth-plus", label: "Fourth year or longer", hint: "You have seen it all" },
  { id: "graduate", label: "Graduate student", hint: "Master's, PhD or beyond" },
];
const LIVING: { id: Living; label: string; hint: string; icon: typeof Home }[] = [
  { id: "residence", label: "On campus", hint: "In a residence hall", icon: Building2 },
  { id: "commute", label: "I commute", hint: "Car, bus or train", icon: Bus },
  { id: "off-campus", label: "Off campus with roommates", hint: "A house or apartment", icon: Sofa },
  { id: "other", label: "Somewhere else", hint: "Home, or it is complicated", icon: Home },
];
const INTERESTS = ["Events", "Meeting people", "Finding roommates", "Buying and selling", "Study groups", "Campus help"];
const LOOKS: { id: Look; label: string; icon: typeof Sun }[] = [{ id: "light", label: "Light", icon: Sun }, { id: "dark", label: "Dark", icon: Moon }, { id: "system", label: "Match my device", icon: Monitor }];

type Step = "campus" | "name" | "tenure" | "living" | "interests" | "about" | "pace" | "nudges" | "look" | "done";
const STEPS: Step[] = ["campus", "name", "tenure", "living", "interests", "about", "pace", "nudges", "look", "done"];

/** The first-time setup: its own full-screen page between signing in and the app. It asks for the university first, because everything else
 *  (the feed, events and map) is limited to that university. Everything you touch answers back: buttons press and lift, the selection glides
 *  between options, the picture reacts to each answer and follows your cursor, and finishing wipes into the app. */
export default function Onboarding() {
  const { session, demo, signOut, refresh } = useAuth();
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const themePref = useThemePref();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [uni, setUni] = useState<University | null>(null);
  const [name, setName] = useState("");
  // Usernames are how friends find you and add you to groups. They need a database, so demo mode skips them.
  // The username picked at sign up (kept with the account) is the starting point; guests and older accounts get one suggested from their name.
  const chosenAtSignUp = (session?.user.user_metadata as { username?: string } | undefined)?.username ?? "";
  const [username, setUsername] = useState(chosenAtSignUp);
  const [userEdited, setUserEdited] = useState(!!chosenAtSignUp);
  const [tenure, setTenure] = useState<Tenure | null>(null);
  const [living, setLiving] = useState<Living | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [hobbyText, setHobbyText] = useState("");
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const [streaks, setStreaks] = useState<boolean | null>(null);
  const [nudges, setNudges] = useState({ hangouts: true, reminders: true, places: true });
  const [look, setLook] = useState<Look>(themePref);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (supabase && !userEdited) setUsername(suggestUsername(name.trim().split(" ")[0] ?? "")); }, [name, userEdited]);
  const [error, setError] = useState("");
  const [kick, setKick] = useState(0);
  const [burst, setBurst] = useState(0);
  const [wipe, setWipe] = useState<{ x: number; y: number } | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const device = useDeviceAlerts();

  const meta = session?.user.user_metadata as { name?: string } | undefined;
  // A name to start from, unless this is a guest: they type their own.
  useEffect(() => {
    const email = session?.user.email;
    if (isGuestEmail(email) || !email || meta?.name === "Guest") return;
    setName((n) => n || meta?.name || email.split("@")[0]);
  }, [meta?.name, session?.user.email]);

  // The picture leans a little toward your cursor.
  const mx = useMotionValue(0), my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 90, damping: 18 }), sy = useSpring(my, { stiffness: 90, damping: 18 });
  const rotY = useTransform(sx, [-1, 1], [-9, 9]), rotX = useTransform(sy, [-1, 1], [7, -7]);
  const shiftX = useTransform(sx, [-1, 1], [-10, 10]), shiftY = useTransform(sy, [-1, 1], [-8, 8]);
  const onMove = (e: PointerEvent) => { if (reduce) return; mx.set((e.clientX / window.innerWidth) * 2 - 1); my.set((e.clientY / window.innerHeight) * 2 - 1); };

  if (!session) return <Navigate to="/login" replace />;

  const step = STEPS[i];
  const years = tenure ? TENURE_YEARS[tenure] : 0;
  const can: Record<Step, boolean> = { campus: !!uni && validCampus(uni.name), name: name.trim().length >= 1 && (!supabase || !checkUsername(username)), tenure: !!tenure, living: !!living, interests: true, about: true, pace: streaks !== null, nudges: true, look: true, done: true };
  const optional = step === "interests" || step === "about" || step === "nudges";
  const aboutEmpty = !bio.trim() && hobbies.length === 0;
  const first = name.trim().split(" ")[0];

  const go = (n: number) => { setDir(n > i ? 1 : -1); setI(n); setError(""); };
  const next = () => { if (can[step] && i < STEPS.length - 1) { setBurst((b) => b + 1); setKick((k) => k + 1); go(i + 1); } };
  const back = () => { if (i > 0) go(i - 1); };
  /** Every answer makes the picture react. */
  const answer = <T,>(set: (v: T) => void) => (v: T) => { set(v); setKick((k) => k + 1); };

  async function finish() {
    if (!uni || !tenure || !living || streaks === null) return;
    setSaving(true); setError("");
    try {
      const key = campusKey(uni.name);
      const profile: Profile = { name: name.trim(), username: supabase ? normalizeUsername(username) : undefined, campusName: uni.name.trim(), campusKey: key, campusDomain: uni.domain || undefined, tenure, living, interests, streaks, nudges, look, doneAt: new Date().toISOString() };
      await feedApi.join({ name: profile.campusName, key }, session!.user.id);
      if (supabase) await supabase.auth.updateUser({ data: { name: profile.name } }); else demoAuth.setName(session!.user.id, profile.name);
      await pushProfile(session!.user.id, profile); // the membership above has to exist first
      saveProfile(session!.user.id, profile);
      // Optional: a failure here never blocks getting into the app; it can be added later in Profile.
      if (!aboutEmpty) await saveAbout(session!.user.id, { bio, hobbies }).catch(() => undefined);
      setThemePref(look);
      progress.setEnabled(streaks);
      resetCampus();
      refresh();
      nav("/app", { replace: true });
    } catch (e) {
      arrival.end();
      setWipe(null);
      const message = (e as Error).message || "";
      if (/username/i.test(message)) { setI(STEPS.indexOf("name")); setError("That username is taken. Pick another."); }
      else setError(message || "Something went wrong saving your answers. Try again.");
      setSaving(false);
    }
  }

  /** Finishing: a violet circle grows from the button and covers the page, then the arrival screen ("Your Orbit is loading") fades away into the app. */
  function enterApp() {
    if (saving) return;
    const r = nextRef.current?.getBoundingClientRect();
    const x = r ? r.left + r.width / 2 : window.innerWidth / 2, y = r ? r.top + r.height / 2 : window.innerHeight / 2;
    if (reduce) { arrival.start(); void finish(); return; }
    setWipe({ x, y });
    // The arrival screen is already solid violet, so it takes over from the circle exactly as the circle finishes growing.
    setTimeout(() => { arrival.start(); void finish(); }, 560);
  }

  async function toggleDevice() {
    setKick((k) => k + 1);
    if (device.on) { disableDeviceAlerts(); return; }
    const r = await enableDeviceAlerts();
    if (r === "denied") notice.show({ icon: "alert", title: "Alerts are blocked", message: "Your browser is blocking notifications from Orbit. You can allow them later from the site settings next to the address bar." });
  }

  const planets = useMemo(() => interests.map((t) => INTERESTS.indexOf(t)), [interests]);
  const toggleInterest = (t: string) => { setInterests((l) => (l.includes(t) ? l.filter((x) => x !== t) : [...l, t])); setKick((k) => k + 1); };

  const title: Record<Step, string> = {
    campus: "Which campus is yours?", name: "What should we call you?", tenure: "How long have you been on campus?", living: "Where do you live?",
    interests: "What are you here for?", about: "Tell us about you", pace: "Want streaks and badges?", nudges: "How can Orbit nudge you?", look: "Pick a look", done: `You are in${first ? `, ${first}` : ""}.`,
  };
  const sub: Record<Step, string> = {
    campus: "Your feed, events and map are just for your university. Start typing its name.",
    name: "This is what other students on your campus will see.",
    tenure: "It helps us show you the right things, and it is never shown to anyone else.",
    living: "So we can point you to the right groups and places.",
    interests: "Pick any that fit, or skip this one.",
    about: "A short bio and what you do in your free time. Everyone on your campus sees it on your profile. Totally optional: skip it and add it later in Profile.",
    pace: "A friendly show-up streak and small badges. Optional, low pressure, and you can change your mind any time.",
    nudges: pushSupported() ? "A bell in the top bar collects what needs you. You can also get alerts on this device, even when Orbit is closed." : "A bell in the top bar collects what needs you. Orbit is a website, so alerts reach your device only while it is open in a tab.",
    look: "You can switch any time from the sidebar.",
    done: `${uni?.name ?? "Your campus"} is ready. Your feed and map are waiting.`,
  };

  const slide = reduce ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.12 } }, exit: { opacity: 0, transition: { duration: 0.1 } } } : {
    initial: { opacity: 0, x: 40 * dir }, animate: { opacity: 1, x: 0, transition: enter }, exit: { opacity: 0, x: -40 * dir, transition: exit },
  };

  const body: Record<Step, ReactNode> = {
    campus: <CampusSearch value={uni} onPick={answer(setUni)} autoFocus />,
    name: (
      <>
        <label className="field"><span className="sr">Your name</span><input className="onb-input" value={name} maxLength={40} autoFocus autoComplete="given-name" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") next(); }} placeholder="Your first name" /></label>
        {supabase && (
          <label className="field onb-username"><span className="onb-label">Your username</span>
            <span className="onb-at"><span aria-hidden="true">@</span><input className="onb-input" value={username} maxLength={20} autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby="onb-username-help" onChange={(e) => { setUserEdited(true); setUsername(normalizeUsername(e.target.value).replace(/[^a-z0-9_]/g, "")); }} onKeyDown={(e) => { if (e.key === "Enter") next(); }} placeholder="username" /></span>
            <small id="onb-username-help" className={username && checkUsername(username) ? "error" : "muted"}>{username && checkUsername(username) ? checkUsername(username) : "Friends find you and add you to groups with this. Letters, numbers and underscores."}</small>
          </label>
        )}
        <AnimatePresence>{first.length >= 2 && <motion.p key="hi" className="onb-hi" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={soft}>Nice to meet you, <strong>{first}</strong>.</motion.p>}</AnimatePresence>
      </>
    ),
    tenure: <div className="onb-choices" role="radiogroup" aria-label="How long you have been on campus">{TENURES.map((t, n) => <Choice key={t.id} group="tenure" index={n} on={tenure === t.id} onClick={() => answer(setTenure)(t.id)} label={t.label} hint={t.hint} />)}</div>,
    living: <div className="onb-choices two" role="radiogroup" aria-label="Where you live">{LIVING.map((l, n) => <Choice key={l.id} group="living" index={n} on={living === l.id} onClick={() => answer(setLiving)(l.id)} label={l.label} hint={l.hint} icon={<l.icon size={20} aria-hidden="true" />} />)}</div>,
    interests: (
      <div className="onb-chips" role="group" aria-label="What you are here for">
        {INTERESTS.map((t, n) => {
          const on = interests.includes(t);
          return (
            <motion.button key={t} type="button" aria-pressed={on} onClick={() => toggleInterest(t)} initial={reduce ? false : { opacity: 0, y: 14, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: on && !reduce ? [1, 1.12, 1] : 1, transition: { ...soft, delay: 0.12 + n * 0.05 } }} whileHover={reduce ? undefined : { y: -2, transition: spring }} whileTap={reduce ? undefined : { scale: 0.92, transition: spring }}>
              <AnimatePresence initial={false}>{on && <motion.span key="c" className="chip-check" initial={{ width: 0, opacity: 0, scale: 0 }} animate={{ width: 14, opacity: 1, scale: 1 }} exit={{ width: 0, opacity: 0, scale: 0 }} transition={spring}><Check size={14} aria-hidden="true" /></motion.span>}</AnimatePresence>
              {t}
            </motion.button>
          );
        })}
      </div>
    ),
    about: (
      <div className="onb-about">
        <div className="field">
          <label className="onb-label" htmlFor="onb-bio">A little about you</label>
          <div className="about-box">
            <textarea id="onb-bio" ref={bioRef} className="onb-input" rows={3} value={bio} placeholder="e.g. Second-year bio major. Coffee, climbing and bad puns." onChange={(e) => { if (bioLength(e.target.value) <= BIO_MAX) { setBio(e.target.value); setKick((k) => k + 1); } }} />
            <div className="about-tools">
              <EmojiButton value={bio} onChange={(v) => { if (bioLength(v) <= BIO_MAX) setBio(v); }} inputRef={bioRef} max={BIO_MAX} />
              <span className={"count" + (bioLength(bio) > BIO_MAX * 0.9 ? " warn" : "")} aria-live="polite">{bioLength(bio)}/{BIO_MAX}</span>
            </div>
          </div>
        </div>
        <div className="field">
          <span className="onb-label" id="onb-free">What do you do in your free time?</span>
          <div className="onb-chips" role="group" aria-labelledby="onb-free">
            {[...HOBBY_IDEAS, ...hobbies.filter((h) => !HOBBY_IDEAS.some((i) => i.toLowerCase() === h.toLowerCase()))].map((t) => {
              const on = hobbies.some((x) => x.toLowerCase() === t.toLowerCase());
              return <button key={t} type="button" aria-pressed={on} onClick={() => { setHobbies((l) => (on ? l.filter((x) => x.toLowerCase() !== t.toLowerCase()) : cleanHobbies([...l, t]))); setKick((k) => k + 1); }}>{on && <Check size={14} aria-hidden="true" />}{t}</button>;
            })}
          </div>
          <input className="onb-input" aria-label="Add your own" value={hobbyText} maxLength={HOBBY_LEN} disabled={hobbies.length >= HOBBY_MAX} placeholder={hobbies.length >= HOBBY_MAX ? `Up to ${HOBBY_MAX}` : "Something else? Type it and press Enter"}
            onChange={(e) => setHobbyText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && hobbyText.trim()) { e.preventDefault(); setHobbies((l) => cleanHobbies([...l, hobbyText])); setHobbyText(""); } }} />
        </div>
      </div>
    ),
    pace: <div className="onb-choices two" role="radiogroup" aria-label="Streaks and badges">
      <Choice group="pace" index={0} on={streaks === true} onClick={() => answer(setStreaks)(true)} label="Yes, count me in" hint="A weekly show-up streak and badges" />
      <Choice group="pace" index={1} on={streaks === false} onClick={() => answer(setStreaks)(false)} label="No thanks" hint="Keep it simple" />
    </div>,
    nudges: <div className="onb-toggles">
      {([["hangouts", "Hangouts that need your answer"], ["reminders", "Reminders you set"], ["places", "Places on the map that need a vote"]] as const).map(([k, label], n) => (
        <Switch key={k} index={n} on={nudges[k]} label={label} onClick={() => { setNudges((s) => ({ ...s, [k]: !s[k] })); setKick((c) => c + 1); }} />
      ))}
      {deviceSupported() && <Switch index={3} on={device.on} label="Alert me on my device" onClick={toggleDevice} />}
    </div>,
    look: <div className="onb-choices three" role="radiogroup" aria-label="Look">{LOOKS.map((l, n) => <Choice key={l.id} group="look" index={n} on={look === l.id} onClick={() => { answer(setLook)(l.id); setThemePref(l.id); }} label={l.label} icon={<l.icon size={20} aria-hidden="true" />} />)}</div>,
    done: <p className="onb-done-note">You can change any of this from your profile.</p>,
  };

  return (
    <main className="onb" onPointerMove={onMove}>
      <header className="onb-top">
        <Link to="/" className="logo" aria-label="Orbit"><i />Orbit</Link>
        <ol className="onb-progress" aria-label={`Step ${i + 1} of ${STEPS.length}`}>
          {STEPS.slice(0, -1).map((s, n) => <li key={s} className={n < i ? "done" : n === i ? "now" : ""} aria-current={n === i ? "step" : undefined}><span /></li>)}
        </ol>
        <button type="button" className="onb-out" onClick={async () => { await signOut(); nav("/login", { replace: true }); }}>Sign out</button>
      </header>
      <div className="onb-stage">
        <motion.div className="onb-art" aria-hidden="true" style={reduce ? undefined : { rotateX: rotX, rotateY: rotY, x: shiftX, y: shiftY, transformPerspective: 900 }}>
          <OrbitArt step={step} rings={years} planets={planets} initial={name.trim().slice(0, 1) || "?"} campus={uni?.name} living={living} done={step === "done"} kick={kick} />
        </motion.div>
        <div className="onb-panel">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} className="onb-step" {...slide}>
              <h1 aria-label={title[step]}><Words text={title[step]} reduce={!!reduce} /></h1>
              <motion.p className="onb-sub" initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { ...soft, delay: 0.18 } }}>{sub[step]}</motion.p>
              <motion.div className="onb-body" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.2, delay: 0.1 } }}>{body[step]}</motion.div>
              {error && <p className="error" role="alert">{error}</p>}
              <div className="onb-actions">
                {i > 0 && step !== "done" && <motion.button type="button" className="onb-back" onClick={back} aria-label="Back" whileHover={reduce ? undefined : { x: -3 }} whileTap={reduce ? undefined : { scale: 0.88 }} transition={spring}><ArrowLeft size={18} aria-hidden="true" /></motion.button>}
                <span className="onb-next-wrap">
                  <motion.button ref={nextRef} type="button" className="btn primary onb-next" disabled={step === "done" ? saving : !can[step]} onClick={step === "done" ? enterApp : next}
                    initial="rest" whileHover={reduce ? undefined : "hover"} whileTap={reduce ? undefined : { scale: 0.94 }} animate={can[step] && !reduce ? { scale: [1, 1.07, 1] } : { scale: 1 }} transition={{ duration: 0.35 }}>
                    <span>{step === "done" ? (saving ? "Setting up…" : "Take me in") : optional && ((step === "interests" && interests.length === 0) || (step === "about" && aboutEmpty)) ? "Skip" : "Continue"}</span>
                    <motion.span className="onb-arrow" variants={{ rest: { x: 0 }, hover: { x: 5 } }} transition={spring}><ArrowRight size={18} aria-hidden="true" /></motion.span>
                  </motion.button>
                  <Burst n={burst} reduce={!!reduce} />
                </span>
                <AnimatePresence mode="popLayout">{step === "interests" && interests.length > 0 && <motion.span key={interests.length} className="onb-count" initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }} transition={spring}>{interests.length} picked</motion.span>}</AnimatePresence>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      {demo && <p className="onb-demo">Demo mode: your answers are saved on this device.</p>}
      <AnimatePresence>
        {wipe && <motion.div className="onb-wipe" aria-hidden="true" initial={{ clipPath: `circle(0px at ${wipe.x}px ${wipe.y}px)` }} animate={{ clipPath: `circle(150vmax at ${wipe.x}px ${wipe.y}px)` }} transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }} />}
      </AnimatePresence>
    </main>
  );
}

/** A heading whose words rise into place one after another. */
function Words({ text, reduce }: { text: string; reduce: boolean }) {
  if (reduce) return <>{text}</>;
  return (
    <>
      {text.split(" ").map((w, n) => (
        <span key={`${w}-${n}`} className="onb-word" aria-hidden="true"><motion.span initial={{ y: "115%", rotate: 4 }} animate={{ y: 0, rotate: 0 }} transition={{ ...spring, delay: 0.04 + n * 0.055 }}>{w}</motion.span></span>
      ))}
    </>
  );
}

/** Tiny flat circles fly out of the button when you move on. */
function Burst({ n, reduce }: { n: number; reduce: boolean }) {
  if (!n || reduce) return null;
  return (
    <span className="onb-burst" key={n} aria-hidden="true">
      {Array.from({ length: 10 }, (_, k) => {
        const a = (k / 10) * Math.PI * 2;
        return <motion.i key={k} initial={{ x: 0, y: 0, scale: 1, opacity: 1 }} animate={{ x: Math.cos(a) * (46 + (k % 3) * 8), y: Math.sin(a) * (30 + (k % 3) * 8), scale: 0, opacity: 0 }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }} style={{ background: CONFETTI[k % CONFETTI.length] }} />;
      })}
    </span>
  );
}

/** A big option. It lifts when you point at it, presses when you tap it, and the selection glides to it from the one you had. */
function Choice({ on, onClick, label, hint, icon, group, index }: { on: boolean; onClick: () => void; label: string; hint?: string; icon?: ReactNode; group: string; index: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.button type="button" role="radio" aria-checked={on} className="onb-choice" onClick={onClick}
      initial={reduce ? false : { opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1, transition: { ...soft, delay: 0.12 + index * 0.06 } }}
      whileHover={reduce ? undefined : { y: -3, transition: spring }} whileTap={reduce ? undefined : { scale: 0.95, transition: spring }}>
      {on && <motion.span layoutId={`hl-${group}`} className="onb-choice-hl" transition={reduce ? { duration: 0.1 } : spring} />}
      {icon && <motion.span className="onb-choice-ico" animate={on && !reduce ? { rotate: [0, -14, 10, 0], scale: [1, 1.2, 1] } : { rotate: 0, scale: 1 }} transition={{ duration: 0.5 }}>{icon}</motion.span>}
      <span className="onb-choice-text"><strong>{label}</strong>{hint && <em>{hint}</em>}</span>
      <span className="onb-check" aria-hidden="true">
        <AnimatePresence initial={false}>{on && <motion.span key="c" className="onb-check-in" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={spring}><Check size={14} strokeWidth={3} /></motion.span>}</AnimatePresence>
      </span>
    </motion.button>
  );
}

/** A switch whose knob springs across and slightly overshoots. */
function Switch({ on, label, onClick, index }: { on: boolean; label: string; onClick: () => void; index: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.button type="button" role="switch" aria-checked={on} onClick={onClick}
      initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0, transition: { ...soft, delay: 0.12 + index * 0.07 } }}
      whileHover={reduce ? undefined : { y: -2, transition: spring }} whileTap={reduce ? undefined : { scale: 0.97, transition: spring }}>
      <motion.span className="sw-bell" animate={on && !reduce ? { rotate: [0, -18, 14, -8, 0] } : { rotate: 0 }} transition={{ duration: 0.5 }}><Bell size={16} aria-hidden="true" /></motion.span>
      <span>{label}</span>
      <motion.i className="sw-track" animate={{ backgroundColor: on ? "var(--violet)" : "var(--line)" }} transition={{ duration: 0.2 }} style={{ justifyContent: on ? "flex-end" : "flex-start" }}>
        <motion.b layout className="sw-knob" transition={{ type: "spring", stiffness: 700, damping: 24 }} />
      </motion.i>
    </motion.button>
  );
}
