import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useDisplayName } from "../lib/displayName";
import { motion } from "framer-motion";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { LayoutGrid, LogOut, Megaphone, Moon, SquarePen, Sun } from "lucide-react";
import { GroupsIcon, HomeIcon, MapIcon, MessagesIcon, PlansIcon, RoommatesIcon } from "./icons";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { enter, slide } from "../lib/motion";
import BadgeToast from "./BadgeToast";
import UndoToast from "./UndoToast";
import NoticeHost from "./NoticeHost";
import { arrival } from "../lib/arrival";
import NotificationBell from "./NotificationBell";
import Orb from "./Orb";
import { useNotifs } from "../lib/notifs";
import type { OrbMood } from "../lib/orbGaze";
import ReminderAlerts from "./ReminderAlerts";
import ClassAlerts from "./ClassAlerts";
import ComposeModal from "./ComposeModal";
import GlobalSearch from "./GlobalSearch";
import { setTheme, useTheme } from "../lib/theme";
import { isVisible, useHang, YOU } from "../lib/hangouts";
import { unreadDms, useDms } from "../lib/dms";
import OfflineBanner from "./OfflineBanner";
import Shortcuts from "./Shortcuts";
import PullToRefresh from "./PullToRefresh";
import { useIsPhone } from "../lib/phone";

const items = [
  { to: "/app/feed", label: "Feed", icon: HomeIcon },
  { to: "/app/messages", label: "Messages", icon: MessagesIcon },
  { to: "/app/groups", label: "Groups", icon: GroupsIcon },
  { to: "/app/roommates", label: "Roommates", icon: RoommatesIcon },
  { to: "/app/plans", label: "Plans", icon: PlansIcon },
  { to: "/app/campus", label: "Campus", icon: Megaphone },
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
  const unread = unreadDms(useDms().threads);
  // The logo orb perks up for a few seconds when something new lands in the bell.
  const bellCount = useNotifs().filter((n) => n.unread).length;
  const prevBell = useRef(bellCount);
  const [logoMood, setLogoMood] = useState<OrbMood>("idle");
  useEffect(() => {
    if (bellCount > prevBell.current) { setLogoMood("excited"); const t = window.setTimeout(() => setLogoMood("idle"), 3500); prevBell.current = bellCount; return () => window.clearTimeout(t); }
    prevBell.current = bellCount;
  }, [bellCount]); // messages you have not opened yet
  // Upcoming hangouts the person has not answered yet. Shown as a small orange dot on Plans.
  const waiting = hangouts.filter((h) => isVisible(h, groups) && !h.rsvps[YOU] && new Date(h.when).getTime() > Date.now()).length;

  // Each page gets its own title, and focus moves to the content so keyboard and screen reader users start there.
  useEffect(() => {
    const here = [...items, { to: "/app/profile", label: "Profile" }].find((i) => loc.pathname.startsWith(i.to));
    document.title = (unread > 0 ? `(${unread > 9 ? "9+" : unread}) ` : "") + (here ? `${here.label} · Orbit` : "Orbit");
  }, [loc.pathname, unread]);
  useEffect(() => { main.current?.focus({ preventScroll: true }); }, [loc.pathname]);
  const name = useDisplayName();

  // The sidebar is icons only, or icons with names (like YouTube); the page beside it makes room. The choice is remembered on this device.
  const [wide, setWide] = useState(() => { try { return localStorage.getItem("orbit-side-wide") === "1"; } catch { return false; } });
  const toggleSide = () => setWide((w) => { try { localStorage.setItem("orbit-side-wide", w ? "0" : "1"); } catch { /* ignore */ } return !w; });

  // On phones the same menu is a drawer that slides in from the left, opened by the Orbit circle at the top.
  const [drawer, setDrawer] = useState(false);
  useEffect(() => { setDrawer(false); }, [loc.pathname]);
  useEffect(() => {
    if (!drawer) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawer(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [drawer]);

  const [composing, setComposing] = useState(false);
  const newPost = () => setComposing(true);

  // Phone: the top bar tucks away when you scroll down and comes back when you scroll up, like a phone app.
  const phone = useIsPhone();
  const [hideTop, setHideTop] = useState(false);
  useEffect(() => {
    if (!phone) { setHideTop(false); return; }
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > last + 10 && y > 90) setHideTop(true); else if (y < last - 10 || y < 40) setHideTop(false);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [phone]);
  useEffect(() => { setHideTop(false); }, [loc.pathname]);
  const pageTitle = [...items, { to: "/app/profile", label: "Profile" }].find((i) => loc.pathname.startsWith(i.to))?.label ?? "Orbit";
  const tabs = items.filter((i) => ["/app/feed", "/app/messages", "/app/groups", "/app/plans", "/app/campus"].includes(i.to));

  return (
    <div className={"shell" + (wide ? " wide" : "") + (hideTop ? " hide-top" : "")}>
      <a className="skip" href="#main">Skip to content</a>
      <aside className="side">
        <div className="side-top">
          <button type="button" className="logo logo-toggle" aria-label={wide ? "Collapse menu" : "Expand menu"} aria-expanded={wide} onClick={toggleSide}><Orb variant="light" mood={logoMood} /><span className="navtext">Orbit</span></button>
        </div>
        <nav className="navgroup" aria-label="Primary">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} title={i.label} aria-label={i.label} className={({ isActive }) => "navlink" + (isActive ? " active" : "")}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="side-indicator" className="navpill" transition={slide} />}
                  <i.icon size={22} strokeWidth={1.75} />
                  <span className="navtext">{i.label}</span>
                  {i.to === "/app/messages" && unread > 0 && <span className="nav-count" role="img" aria-label={`${unread} unread ${unread === 1 ? "message" : "messages"}`}>{unread > 9 ? "9+" : unread}</span>}
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
          <button type="button" className="logo logo-mobile" aria-label="Open menu" aria-expanded={drawer} onClick={() => setDrawer(true)}><Orb variant="violet" mood={logoMood} /></button>
          <span className="top-title" aria-hidden="true">{pageTitle}</span>
          <GlobalSearch />
          <NotificationBell />
          <NavLink to="/app/profile" title="Profile" aria-label="Profile" className="me topme">{name.slice(0, 1).toUpperCase()}</NavLink>
        </div>
        <motion.main key={loc.pathname} id="main" tabIndex={-1} ref={main} className="main" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={enter}>
          <Outlet />
        </motion.main>
      </div>
      <nav className="tabbar" aria-label="Main">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => "tab" + (isActive ? " active" : "")}>
            <span className="tab-ico"><t.icon size={22} strokeWidth={1.75} />
              {t.to === "/app/messages" && unread > 0 && <b className="tab-count" role="img" aria-label={`${unread} unread`}>{unread > 9 ? "9+" : unread}</b>}
              {t.to === "/app/plans" && waiting > 0 && <i className="tab-dot" role="img" aria-label={`${waiting} need your answer`} />}
            </span>
            <span className="tab-label">{t.label}</span>
          </NavLink>
        ))}
        <button type="button" className={"tab" + (drawer ? " active" : "")} aria-label="More" aria-expanded={drawer} onClick={() => setDrawer(true)}>
          <span className="tab-ico"><LayoutGrid size={22} strokeWidth={1.75} /></span><span className="tab-label">More</span>
        </button>
      </nav>
      {loc.pathname.startsWith("/app/feed") && <button type="button" className="fab" aria-label="New post" onClick={newPost}><SquarePen size={24} strokeWidth={1.9} aria-hidden="true" /></button>}
      <div className={"drawer-scrim" + (drawer ? " open" : "")} aria-hidden="true" onClick={() => setDrawer(false)} />
      <nav className={"drawer" + (drawer ? " open" : "")} aria-label="Menu" aria-hidden={!drawer} inert={!drawer}>
        <div className="drawer-head"><span className="logo"><Orb variant="violet" /><span>Orbit</span></span></div>
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} className={({ isActive }) => "drawer-link" + (isActive ? " active" : "")}>
            <i.icon size={22} strokeWidth={1.75} /><span>{i.label}</span>
            {i.to === "/app/messages" && unread > 0 && <b className="drawer-count">{unread > 9 ? "9+" : unread}</b>}
          </NavLink>
        ))}
        <NavLink to="/app/profile" className={({ isActive }) => "drawer-link" + (isActive ? " active" : "")}><span className="me">{name.slice(0, 1).toUpperCase()}</span><span>Profile</span></NavLink>
        <button type="button" className="drawer-link" onClick={() => { setDrawer(false); newPost(); }}><SquarePen size={22} strokeWidth={1.75} /><span>New post</span></button>
        <span className="spacer" />
        <button type="button" className="drawer-link" onClick={() => setTheme(dark ? "light" : "dark")}>{dark ? <Sun size={22} strokeWidth={1.75} /> : <Moon size={22} strokeWidth={1.75} />}<span>{dark ? "Light mode" : "Dark mode"}</span></button>
        <button type="button" className="drawer-link" onClick={async () => { await signOut(); nav("/login", { replace: true }); }}><LogOut size={22} strokeWidth={1.75} /><span>Sign out</span></button>
      </nav>
      <OfflineBanner />
      <PullToRefresh />
      <Shortcuts onNew={newPost} />
      <BadgeToast />
      <UndoToast />
      <NoticeHost />
      <ReminderAlerts />
      <ClassAlerts />
      <ComposeModal open={composing} onClose={() => setComposing(false)} />
    </div>
  );
}
