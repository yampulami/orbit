import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, MessageCircle, CalendarDays, ShieldCheck } from "lucide-react";
import { useAuth } from "../lib/auth";

const features = [
  { icon: Users, title: "Your campus feed", body: "Posts, events, and marketplace listings — scoped to your university only." },
  { icon: MessageCircle, title: "Messages & groups", body: "Direct messages and group chats for clubs, classes, and friends." },
  { icon: CalendarDays, title: "Plans that work", body: "Hangouts, chores, and shared expenses without the group-chat chaos." },
  { icon: ShieldCheck, title: "Safety built in", body: "Blocking, reporting, and campus-isolated data from day one." },
];

export default function Landing() {
  const { session } = useAuth();
  return (
    <>
      <div className="container">
        <nav className="nav">
          <span className="logo"><i />Orbit</span>
          <div style={{ display: "flex", gap: 8 }}>
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
        <div className="container">Orbit — a senior capstone project. Email sign-up does not verify university enrollment.</div>
      </footer>
    </>
  );
}
