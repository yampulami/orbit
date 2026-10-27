import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../lib/auth";
import { ThemeToggleButton } from "../components/ThemeControls";
import LandingOrbs from "../components/LandingOrbs";
import Orb from "../components/Orb";

const inside = [
  { title: "Your campus feed", body: "Posts, events and listings, only from your university." },
  { title: "Messages and groups", body: "Chats for clubs, classes and friends." },
  { title: "Plans that work", body: "Plan a hangout, answer yes or no, see it on one calendar." },
  { title: "Safety built in", body: "Blocking, reporting and campus-only data from day one." },
];

export default function Landing() {
  const { session } = useAuth();
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
                <Link className="btn primary" to="/signup">Get started</Link>
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
          {inside.map((f) => <div key={f.title}><h3>{f.title}</h3><p className="muted">{f.body}</p></div>)}
        </section>
      </div>
      <footer className="footer">
        <div className="container">Orbit, a senior capstone project. Email sign-up does not verify university enrollment. <Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link></div>
      </footer>
    </>
  );
}
