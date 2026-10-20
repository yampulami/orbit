import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useRef, type ComponentType } from "react";
import { LogOut, Moon, Plus, Sun } from "lucide-react";
import { GroupsIcon, HomeIcon, MessagesIcon, PlansIcon } from "./icons";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { enter, slide } from "../lib/motion";
import BadgeToast from "./BadgeToast";
import UndoToast from "./UndoToast";
import { setTheme, useTheme } from "../lib/theme";
import { useHang, YOU } from "../lib/hangouts";

const items = [
  { to: "/app/feed", label: "Feed", icon: HomeIcon },
  { to: "/app/messages", label: "Messages", icon: MessagesIcon },
  { to: "/app/groups", label: "Groups", icon: GroupsIcon },
  { to: "/app/plans", label: "Plans", icon: PlansIcon },
];

export default function Shell() {
  const loc = useLocation();
  const nav = useNavigate();
  const { session } = useAuth();
  const dark = useTheme() === "dark";
  const main = useRef<HTMLElement>(null);
  const { groups, hangouts } = useHang();
  // Upcoming hangouts the person has not answered yet. Shown as a small orange dot on Plans.
  const waiting = hangouts.filter((h) => !h.canceled && !h.rsvps[YOU] && new Date(h.when).getTime() > Date.now() && groups.some((g) => g.id === h.groupId)).length;

  // Each page gets its own title, and focus moves to the content so keyboard and screen reader users start there.
  useEffect(() => {
    const here = [...items, { to: "/app/profile", label: "Profile" }].find((i) => loc.pathname.startsWith(i.to));
    document.title = here ? `${here.label} · Orbit` : "Orbit";
    main.current?.focus({ preventScroll: true });
  }, [loc.pathname]);
  const name = (session?.user.user_metadata?.name as string | undefined) || session?.user.email?.split("@")[0] || "Student";

  const newPost = () => {
    nav("/app/feed");
    setTimeout(() => document.getElementById("composer")?.focus(), 60);
  };

  return (
    <div className="shell">
      <a className="skip" href="#main">Skip to content</a>
      <aside className="side">
        <NavLink to="/app/feed" className="logo" aria-label="Orbit home"><i /></NavLink>
        <button className="navlink solo" title="New post" aria-label="New post" onClick={newPost}><Plus size={22} strokeWidth={1.75} /></button>
        <nav className="navgroup" aria-label="Primary">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} title={i.label} aria-label={i.label} className={({ isActive }) => "navlink" + (isActive ? " active" : "")}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="side-indicator" className="navpill" transition={slide} />}
                  <i.icon size={22} strokeWidth={1.75} />
                  {i.to === "/app/plans" && waiting > 0 && <span className="nav-dot" role="img" aria-label={waiting === 1 ? "1 hangout needs your answer" : `${waiting} hangouts need your answer`} />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <span className="spacer" />
        <button className="navlink extra" title={dark ? "Switch to light mode" : "Switch to dark mode"} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={dark} onClick={() => setTheme(dark ? "light" : "dark")}>
          {dark ? <Sun size={22} strokeWidth={1.75} /> : <Moon size={22} strokeWidth={1.75} />}
        </button>
        <button className="navlink extra" title="Sign out" aria-label="Sign out" onClick={() => (supabase ? supabase.auth.signOut() : nav("/"))}>
          <LogOut size={22} strokeWidth={1.75} />
        </button>
        <NavLink to="/app/profile" title="Profile" aria-label="Profile" className="me">{name.slice(0, 1).toUpperCase()}</NavLink>
      </aside>
      <motion.main key={loc.pathname} id="main" tabIndex={-1} ref={main} className="main" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={enter}>
        <Outlet />
      </motion.main>
      <BadgeToast />
      <UndoToast />
    </div>
  );
}
