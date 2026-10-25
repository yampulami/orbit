import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useDisplayName } from "../lib/displayName";
import { motion } from "framer-motion";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { LogOut, Menu, Moon, SquarePen, Sun } from "lucide-react";
import { GroupsIcon, HomeIcon, MapIcon, MessagesIcon, PlansIcon, RoommatesIcon } from "./icons";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { enter, slide } from "../lib/motion";
import BadgeToast from "./BadgeToast";
import UndoToast from "./UndoToast";
import NoticeHost from "./NoticeHost";
import { arrival } from "../lib/arrival";
import NotificationBell from "./NotificationBell";
import ReminderAlerts from "./ReminderAlerts";
import ComposeModal from "./ComposeModal";
import GlobalSearch from "./GlobalSearch";
import { setTheme, useTheme } from "../lib/theme";
import { isVisible, useHang, YOU } from "../lib/hangouts";

const items = [
  { to: "/app/feed", label: "Feed", icon: HomeIcon },
  { to: "/app/messages", label: "Messages", icon: MessagesIcon },
  { to: "/app/groups", label: "Groups", icon: GroupsIcon },
  { to: "/app/roommates", label: "Roommates", icon: RoommatesIcon },
  { to: "/app/plans", label: "Plans", icon: PlansIcon },
  { to: "/app/map", label: "Map", icon: MapIcon },
];

export default function Shell() {
  const loc = useLocation();
  const nav = useNavigate();
  const { session, signOut } = useAuth();
  const dark = useTheme() === "dark";
  const main = useRef<HTMLElement>(null);
  useEffect(() => { arrival.shellReady(); }, []); // the screen that follows onboarding fades once the app is up
  const { groups, hangouts } = useHang();
  // Upcoming hangouts the person has not answered yet. Shown as a small orange dot on Plans.
  const waiting = hangouts.filter((h) => isVisible(h, groups) && !h.rsvps[YOU] && new Date(h.when).getTime() > Date.now()).length;

  // Each page gets its own title, and focus moves to the content so keyboard and screen reader users start there.
  useEffect(() => {
    const here = [...items, { to: "/app/profile", label: "Profile" }].find((i) => loc.pathname.startsWith(i.to));
    document.title = here ? `${here.label} · Orbit` : "Orbit";
    main.current?.focus({ preventScroll: true });
  }, [loc.pathname]);
  const name = useDisplayName();

  // The sidebar is icons only, or icons with names (like YouTube). The choice is remembered on this device.
  const [wide, setWide] = useState(() => { try { return localStorage.getItem("orbit-side-wide") === "1"; } catch { return false; } });
  const toggleSide = () => setWide((w) => { try { localStorage.setItem("orbit-side-wide", w ? "0" : "1"); } catch { /* ignore */ } return !w; });

  const [composing, setComposing] = useState(false);
  const newPost = () => setComposing(true);

  return (
    <div className={"shell" + (wide ? " wide" : "")}>
      <a className="skip" href="#main">Skip to content</a>
      <aside className="side">
        <div className="side-top">
          <button type="button" className="side-toggle" aria-label={wide ? "Collapse menu" : "Expand menu"} aria-expanded={wide} onClick={toggleSide}><Menu size={22} strokeWidth={1.9} aria-hidden="true" /></button>
          <NavLink to="/app/feed" className="logo" aria-label="Orbit home"><i /><span className="navtext">Orbit</span></NavLink>
        </div>
        <nav className="navgroup" aria-label="Primary">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} title={i.label} aria-label={i.label} className={({ isActive }) => "navlink" + (isActive ? " active" : "")}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="side-indicator" className="navpill" transition={slide} />}
                  <i.icon size={22} strokeWidth={1.75} />
                  <span className="navtext">{i.label}</span>
                  {i.to === "/app/plans" && waiting > 0 && <span className="nav-dot" role="img" aria-label={waiting === 1 ? "1 hangout needs your answer" : `${waiting} hangouts need your answer`} />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <button className="compose-btn solo" title="New post" aria-label="New post" onClick={newPost}><SquarePen size={24} strokeWidth={1.9} aria-hidden="true" /><span className="navtext">New post</span></button>
        <span className="spacer" />
        <button className="navlink extra" title={dark ? "Switch to light mode" : "Switch to dark mode"} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={dark} onClick={() => setTheme(dark ? "light" : "dark")}>
          {dark ? <Sun size={22} strokeWidth={1.75} /> : <Moon size={22} strokeWidth={1.75} />}
          <span className="navtext">{dark ? "Light mode" : "Dark mode"}</span>
        </button>
        <button className="navlink extra" title="Sign out" aria-label="Sign out" onClick={async () => { await signOut(); nav("/login", { replace: true }); }}>
          <LogOut size={22} strokeWidth={1.75} />
          <span className="navtext">Sign out</span>
        </button>
        <NavLink to="/app/profile" title="Profile" aria-label="Profile" className="me">{name.slice(0, 1).toUpperCase()}</NavLink>
      </aside>
      <div className="content">
        <div className="topline">
          <GlobalSearch />
          <NotificationBell />
          <NavLink to="/app/profile" title="Profile" aria-label="Profile" className="me topme">{name.slice(0, 1).toUpperCase()}</NavLink>
        </div>
        <motion.main key={loc.pathname} id="main" tabIndex={-1} ref={main} className="main" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={enter}>
          <Outlet />
        </motion.main>
      </div>
      <BadgeToast />
      <UndoToast />
      <NoticeHost />
      <ReminderAlerts />
      <ComposeModal open={composing} onClose={() => setComposing(false)} />
    </div>
  );
}
