import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Home, MessageCircle, Users, CalendarDays, User, LogOut } from "lucide-react";
import { supabase } from "../lib/supabase";

const items = [
  { to: "/app/feed", label: "Feed", icon: Home },
  { to: "/app/messages", label: "Messages", icon: MessageCircle },
  { to: "/app/groups", label: "Groups", icon: Users },
  { to: "/app/plans", label: "Plans", icon: CalendarDays },
  { to: "/app/profile", label: "Profile", icon: User },
];

export default function Shell() {
  const loc = useLocation();
  const nav = useNavigate();
  return (
    <div className="shell">
      <aside className="side">
        <span className="logo"><i />Orbit</span>
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} className={({ isActive }) => "navlink" + (isActive ? " active" : "")}>
            <i.icon size={20} />{i.label}
          </NavLink>
        ))}
        <span className="spacer" />
        <button className="navlink" style={{ background: "none", border: 0, cursor: "pointer" }} onClick={() => (supabase ? supabase.auth.signOut() : nav("/"))}>
          <LogOut size={20} />Sign out
        </button>
      </aside>
      <AnimatePresence mode="wait">
        <motion.main key={loc.pathname} className="main" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <Outlet />
        </motion.main>
      </AnimatePresence>
      <nav className="tabbar" aria-label="Primary">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} className={({ isActive }) => (isActive ? "active" : "")}>
            <i.icon size={22} />{i.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
