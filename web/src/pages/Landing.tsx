import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../lib/auth";
import { ThemeToggleButton } from "../components/ThemeControls";
import Orb from "../components/Orb";
import HalftoneWordmark from "../components/HalftoneWordmark";

const inside = [
  { title: "Your campus feed", body: "Posts, events and listings from your own university, ordered for you, with what your friends reposted first." },
  { title: "Messages and groups", body: "Chats for clubs, classes and friends. Message requests keep strangers out of your inbox." },
  { title: "Plans that work", body: "Plan a hangout, answer yes or no, and see classes, plans and events on one calendar." },
  { title: "Safety built in", body: "Blocking, reporting and campus-only data from day one." },
];

/** An example of what Find a time gives you, drawn here rather than screenshotted so it stays sharp and readable. The times are made up. */
const sample = [
  { when: "Tue, Nov 10 · 5:00 to 6:00 PM", why: "Everyone is free, with comfortable gaps around it", best: true },
  { when: "Wed, Nov 11 · 12:30 to 1:30 PM", why: "Everyone is free", best: false },
  { when: "Thu, Nov 12 · 4:00 to 5:00 PM", why: "2 of 3 are free, Sam has class", best: false },
];

/** The dots are drawn on a canvas, which cannot read CSS variables, so the page's own colours and fonts are read here and follow light and dark. */
function useStageLook() {
  const [look, setLook] = useState<{ palette: { background: string; ink: string; warm: string }; display: string; text: string } | null>(null);
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      const v = (name: string) => cs.getPropertyValue(name).trim();
      setLook({ palette: { background: v("--bg"), ink: v("--ink"), warm: v("--accent") }, display: v("--display"), text: v("--font") });
    };
    read();
    const watch = new MutationObserver(read);
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => watch.disconnect();
  }, []);
  return look;
}

export default function Landing() {
  const { session } = useAuth();
  const look = useStageLook();
  const copy = (
    <div className="hl-stage">
      <nav className="hl-nav" aria-label="Orbit">
        <span className="logo"><Orb variant="violet" />Orbit</span>
        <div className="hl-nav-act">
          <ThemeToggleButton />
          {session ? (
            <Link className="btn primary" to="/app">Open app</Link>
          ) : (
            <>
              <Link className="btn" to="/login">Sign in</Link>
              <Link className="btn primary" to="/signup">Create account</Link>
            </>
          )}
        </div>
      </nav>
      <div className="hl-copy">
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>Campus life, in one place.</motion.h1>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          Your feed, groups, messages and plans together, and a way to find the hour you are both free. Built for students, private to your campus.
        </motion.p>
        <motion.div className="hl-cta" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <Link className="btn primary" data-cta to={session ? "/app" : "/signup"}>{session ? "Open app" : "Create your account"}</Link>
          <a className="btn" data-cta href="#inside">See what&rsquo;s inside</a>
        </motion.div>
      </div>
    </div>
  );

  return (
    <div className="hl">
      {look ? (
        <HalftoneWordmark
          tag="header"
          bare
          wordmark="orbit"
          palette={look.palette}
          fontFamily={look.display || undefined}
          fontWeight={800}
          monoFamily={look.text || undefined}
          crop={0.08}
          height="clamp(560px, 100svh, 980px)"
        >
          {copy}
        </HalftoneWordmark>
      ) : (
        <header className="hl-plain">{copy}</header>
      )}

      <section className="hl-section hl-glimpse" aria-labelledby="hl-find">
        <div>
          <h2 id="hl-find">Find the hour you&rsquo;re both free.</h2>
          <p>Share when you are busy with the friends you choose, never what for or where. Orbit lists the times everyone can make, best first, and says why. Then plan it in one tap.</p>
        </div>
        <div className="hl-card" role="img" aria-label="Example of Orbit's Find a time: the best time is Tuesday 5 to 6 PM when everyone is free, then two more options.">
          <p className="hl-card-note" aria-hidden="true">Example</p>
          {sample.map((s) => (
            <div key={s.when} className={"hl-time" + (s.best ? " best" : "")} aria-hidden="true">
              <strong>{s.when}</strong>
              {s.best && <em>Best time</em>}
              <span>{s.why}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="inside" className="hl-section hl-inside" aria-label="What is inside Orbit">
        {inside.map((f) => <div key={f.title}><h2>{f.title}</h2><p>{f.body}</p></div>)}
      </section>

      <footer className="hl-foot">
        <p>Orbit, a senior capstone project. Sign-up does not verify university enrollment.</p>
        <nav aria-label="Legal and contact">
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <a href="mailto:orbit.app.mails@gmail.com">Contact</a>
        </nav>
      </footer>
    </div>
  );
}
