import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../lib/auth";
import { ThemeToggleButton } from "../components/ThemeControls";
import Orb from "../components/Orb";
import HalftoneWordmark from "../components/HalftoneWordmark";

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
          Feed, chats, plans and clubs for your university, private to your campus.
        </motion.p>
        <motion.div className="hl-cta" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <Link className="btn primary" data-cta to={session ? "/app" : "/signup"}>{session ? "Open app" : "Create your account"}</Link>
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
