import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../lib/auth";
import { ThemeToggleButton } from "../components/ThemeControls";
import LandingOrbs from "../components/LandingOrbs";
import Orb from "../components/Orb";
import HalftoneWordmark from "../components/HalftoneWordmark";

/** The footer's dots are drawn on a canvas, which cannot read CSS variables, so the page's own colours and fonts are read here and follow light and dark. */
function useFooterLook() {
  const [look, setLook] = useState<{ palette: { background: string; ink: string; warm: string }; display: string; text: string } | null>(null);
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      const v = (name: string) => cs.getPropertyValue(name).trim();
      setLook({ palette: { background: v("--bg"), ink: v("--ink-soft"), warm: v("--accent") }, display: v("--display"), text: v("--font") });
    };
    read();
    // Watch the page's own theme switch rather than guessing when it has finished.
    const watch = new MutationObserver(read);
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => watch.disconnect();
  }, []);
  return look;
}

/** A picture of the one idea in the headline: three evenings, and the hour they all have free. */
const HOURS = ["12", "1", "2", "3", "4", "5", "6", "7"];
const PEOPLE: { who: string; free: boolean[] }[] = [
  { who: "You", free: [false, false, true, true, true, true, false, true] },
  { who: "Sam", free: [true, false, false, true, true, true, true, false] },
  { who: "Priya", free: [false, true, false, false, true, true, false, false] },
];
function FindTheHour() {
  const all = HOURS.map((_, h) => PEOPLE.every((p) => p.free[h]));
  const runStart = all.indexOf(true);
  const runEnd = all.lastIndexOf(true);
  const label = runStart >= 0 ? `${HOURS[runStart]}–${(Number(HOURS[runEnd]) % 12) + 1} pm` : "";
  return (
    <section className="land-find" aria-label="How Orbit finds a time">
      <p className="land-find-note">Everyone shares when they are free. Orbit shows the hours that line up.</p>
      <div className="land-find-card" role="img" aria-label={`Three people's free hours. Everyone is free ${label}.`}>
        <div className="land-find-head"><span />{HOURS.map((h) => <b key={h}>{h}</b>)}</div>
        {PEOPLE.map((p) => (
          <div className="land-find-row" key={p.who}><span>{p.who}</span>{p.free.map((f, h) => <i key={h} data-free={f || undefined} data-all={all[h] || undefined} />)}</div>
        ))}
        {runStart >= 0 && <p className="land-find-answer">Everyone is free <strong>{label}</strong></p>}
      </div>
    </section>
  );
}

export default function Landing() {
  const { session, signInGuest } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  async function tryDemo() {
    setBusy(true); setProblem("");
    const err = await signInGuest();
    if (err) { setProblem(err); setBusy(false); } else nav("/onboarding", { replace: true });
  }
  const look = useFooterLook();
  return (
    <>
      <div className="container">
        <nav className="nav">
          <span className="logo"><Orb variant="violet" />Orbit</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <ThemeToggleButton />
            {!session && <Link className="btn" to="/login">Sign in</Link>}
          </div>
        </nav>

        <header className="land-hero">
          <LandingOrbs />
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>Find the hour you’re both free.</motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            One place for your campus: the feed, chats, plans, a map and a marketplace. Orbit finds a time that works for everyone in the group.
          </motion.p>
          <motion.div className="row" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
            <Link className="btn primary" data-cta to={session ? "/app" : "/signup"}>{session ? "Open app" : "Create your account"}</Link>
            {!session && <button type="button" className="land-demo" disabled={busy} onClick={() => void tryDemo()}>{busy ? "Opening…" : "Try the demo"}</button>}
          </motion.div>
          {problem && <p className="muted" role="alert">{problem}</p>}
        </header>

        <FindTheHour />
      </div>
      {look && (
        <HalftoneWordmark
          tag="footer"
          bare
          wordmark="orbit"
          palette={look.palette}
          fontFamily={look.display || undefined}
          fontWeight={800}
          monoFamily={look.text || undefined}
          crop={0.12}
          height="clamp(180px, 17vw, 260px)"
        />
      )}
      <p className="land-fine">Capstone project, not verified by any university. <Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link> · <a href="mailto:orbit.app.mails@gmail.com">Contact</a></p>
    </>
  );
}
