import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../lib/auth";
import { ThemeToggleButton } from "../components/ThemeControls";
import LandingOrbs from "../components/LandingOrbs";
import Orb from "../components/Orb";
import HalftoneWordmarkFooter, { type FooterColumn } from "../components/HalftoneWordmarkFooter";

const inside = [
  { title: "Your campus feed", body: "Posts, events and listings, only from your university." },
  { title: "Messages and groups", body: "Chats for clubs, classes and friends." },
  { title: "Plans that work", body: "Plan a hangout, answer yes or no, see it on one calendar." },
  { title: "Safety built in", body: "Blocking, reporting and campus-only data from day one." },
];

const FOOTER_COLUMNS: FooterColumn[] = [
  { title: "Orbit", links: [{ label: "Create account", to: "/signup" }, { label: "Sign in", to: "/login" }, { label: "What’s inside", href: "#inside" }] },
  { title: "Legal", links: [{ label: "Terms", to: "/terms" }, { label: "Privacy", to: "/privacy" }] },
  { title: "Contact", links: [{ label: "orbit.app.mails@gmail.com", href: "mailto:orbit.app.mails@gmail.com" }] },
];

/** The footer's dots are drawn on a canvas, which cannot read CSS variables, so the page's own colours and fonts are read here and follow light and dark. */
function useFooterLook() {
  const [look, setLook] = useState<{ palette: { background: string; ink: string; warm: string }; display: string; text: string } | null>(null);
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      const v = (name: string) => cs.getPropertyValue(name).trim();
      setLook({ palette: { background: v("--bg"), ink: v("--ink"), warm: v("--accent") }, display: v("--display"), text: v("--font") });
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
                <Link className="btn primary" to="/signup">Create account</Link>
              </>
            )}
          </div>
        </nav>

        <header className="land-hero">
          <LandingOrbs />
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>Campus life, in one place.</motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            Your feed, groups, messages and plans together. Built for students, private to your campus.
          </motion.p>
          <motion.div className="row" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
            <Link className="btn primary" data-cta to={session ? "/app" : "/signup"}>{session ? "Open app" : "Create your account"}</Link>
            <a className="btn" data-cta href="#inside">See what’s inside</a>
          </motion.div>
        </header>

        <section id="inside" className="land-inside" aria-label="What is inside Orbit">
          {inside.map((f) => <div key={f.title}><h2>{f.title}</h2><p className="muted">{f.body}</p></div>)}
        </section>
      </div>
      {look && (
        <HalftoneWordmarkFooter
          wordmark="orbit"
          label="Orbit"
          meta="A senior capstone project. Sign-up does not verify university enrollment."
          columns={FOOTER_COLUMNS}
          palette={look.palette}
          fontFamily={look.display || undefined}
          fontWeight={800}
          monoFamily={look.text || undefined}
          height="clamp(540px, 46vw, 560px)"
        />
      )}
    </>
  );
}
