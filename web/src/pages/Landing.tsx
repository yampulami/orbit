import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, MessageCircle, CalendarDays, ShieldCheck } from "lucide-react";
import { useAuth } from "../lib/auth";
import { ThemeToggleButton } from "../components/ThemeControls";
import OrbGL from "../components/OrbGL";

const features = [
  { icon: Users, title: "Your campus feed", body: "Posts, events, and marketplace listings — scoped to your university only." },
  { icon: MessageCircle, title: "Messages & groups", body: "Direct messages and group chats for clubs, classes, and friends." },
  { icon: CalendarDays, title: "Plans that work", body: "Plan a hangout with your friend group, answer Yes or No, and see it all on one calendar." },
  { icon: ShieldCheck, title: "Safety built in", body: "Blocking, reporting, and campus-isolated data from day one." },
];

export default function Landing() {
  const { session } = useAuth();
  return (
    <>
      <div className="container">
        <nav className="nav">
          <span className="logo"><i />Orbit</span>
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

        <header className="hero">
          <div className="hero-copy">
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              Campus life, in one place.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
              Orbit brings your feed, groups, messages, and plans together — built for students, and private to your campus.
            </motion.p>
            <motion.div className="row" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
              <Link className="btn primary" to={session ? "/app" : "/signup"}>{session ? "Open app" : "Create your account"}</Link>
              <a className="btn" href="#features">See what’s inside</a>
            </motion.div>
          </div>
          {/* A picture of the app, with made-up sample content. Decorative only. */}
          <motion.div className="hero-art" aria-hidden="true" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}>
            <OrbGL size={190} className="hero-orb" />
            <article className="hang" data-tone="1">
              <div className="hang-top"><span className="chip">Coffee crew</span><span className="hang-when">Sat, Oct 24 · 10:00 AM</span></div>
              <h3>Coffee break</h3>
              <p className="hang-place">Student Center café</p>
              <div className="hang-foot">
                <div className="hang-people"><span className="avatars"><span>M</span><span>J</span><span>Y</span></span><span className="hang-count">3 going</span></div>
                <div className="rsvp">
                  <button type="button" data-a="yes" aria-pressed="true" tabIndex={-1}><span className="thumb" /><span>Yes</span></button>
                  <button type="button" data-a="no" aria-pressed="false" tabIndex={-1}><span>No</span></button>
                </div>
              </div>
            </article>
            <article className="post tile hero-post" data-c="Roommates">
              <div className="meta"><span><strong>Lee</strong> · 1h ago</span><span className="chip">Roommates</span></div>
              <p className="body">Quiet hours start at 10pm in Hamilton Hall this week. Thanks all!</p>
            </article>
          </motion.div>
        </header>

        <section id="features" className="grid">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              className="card feature"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
            >
              <f.icon size={26} />
              <h3>{f.title}</h3>
              <p className="muted">{f.body}</p>
            </motion.div>
          ))}
        </section>
      </div>
      <footer className="footer">
        <div className="container">Orbit — a senior capstone project. Email sign-up does not verify university enrollment. <Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link></div>
      </footer>
    </>
  );
}
