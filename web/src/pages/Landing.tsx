import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

export default function Landing() {
  const { session } = useAuth();
  const look = useFooterLook();
  return (
    <>
      <div className="container">
        <nav className="nav">
          <span className="logo"><Orb variant="violet" />Orbit</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <ThemeToggleButton />
            {session ? (
              <Link className="btn primary" to="/app">Open app</Link>
            ) : (
              <>
                <Link className="btn" to="/login">Sign in</Link>
              </>
            )}
          </div>
        </nav>

        <header className="land-hero">
          <LandingOrbs />
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>Campus life, in one place.</motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            Feed, chats and plans for your campus.
          </motion.p>
          <motion.div className="row" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
            <Link className="btn primary" data-cta to={session ? "/app" : "/signup"}>{session ? "Open app" : "Create your account"}</Link>
          </motion.div>
        </header>

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
