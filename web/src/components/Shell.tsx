import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useDisplayName } from "../lib/displayName";
import { motion } from "framer-motion";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { CalendarClock, Check, Keyboard, LayoutGrid, LogOut, Megaphone, Moon, PanelLeft, SquarePen, Sun } from "lucide-react";
import { HomeIcon, MapIcon, MessagesIcon, PlansIcon, RoommatesIcon } from "./icons";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { enter, slide } from "../lib/motion";
import BadgeToast from "./BadgeToast";
import UndoToast from "./UndoToast";
import NoticeHost from "./NoticeHost";
import { arrival } from "../lib/arrival";
import NotificationBell from "./NotificationBell";
import Orb from "./Orb";
import Assistant from "./Assistant";
import { useNotifs } from "../lib/notifs";
import type { OrbMood } from "../lib/orbGaze";
import { isNight } from "../lib/cheer";
import ReminderAlerts from "./ReminderAlerts";
import ClassAlerts from "./ClassAlerts";
import ComposeModal from "./ComposeModal";
import type { Community } from "../shared/feed";
import GlobalSearch from "./GlobalSearch";
import { setTheme, useTheme } from "../lib/theme";
import { isVisible, useHang, YOU } from "../lib/hangouts";
import { unreadDms, useDms } from "../lib/dms";
import OfflineBanner from "./OfflineBanner";
import Shortcuts from "./Shortcuts";
import PullToRefresh from "./PullToRefresh";
import { useIsPhone } from "../lib/phone";
import { GO } from "../lib/shortcuts";

type SideMode = "hover" | "expanded" | "collapsed";
const SIDE_MODES: { id: SideMode; label: string }[] = [{ id: "expanded", label: "Expanded" }, { id: "collapsed", label: "Collapsed" }, { id: "hover", label: "Expand on hover" }];

const items = [
  { to: "/app/feed", label: "Feed", icon: HomeIcon },
  { to: "/app/chats", label: "Chats", icon: MessagesIcon },
  { to: "/app/roommates", label: "Roommates", icon: RoommatesIcon },
  { to: "/app/plans", label: "Plans", icon: PlansIcon },
  { to: "/app/sync", label: "Free time", icon: CalendarClock },
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
  const [excited, setLogoMood] = useState<OrbMood>("idle");
  // Late at night the logo orb gets drowsy; tapping it wakes it for a while.
  const [night, setNight] = useState(() => isNight(new Date()));
  const [wakeUntil, setWakeUntil] = useState(0);
  const [, rerender] = useState(0);
  useEffect(() => { const t = window.setInterval(() => setNight(isNight(new Date())), 60_000); return () => window.clearInterval(t); }, []);
  const logoMood: OrbMood = excited === "excited" ? "excited" : night && Date.now() > wakeUntil ? "sleepy" : "idle";
  const wake = () => { setWakeUntil(Date.now() + 90_000); window.setTimeout(() => rerender((n) => n + 1), 90_500); };
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

  // The left bar works like the one in the Supabase dashboard: icons only that open over the page while you point at them, or pinned open
  // (the page makes room), or pinned shut. The choice is remembered on this device.
  const [sideMode, setSideMode] = useState<SideMode>(() => { try { const m = localStorage.getItem("orbit-side-mode"); return m === "expanded" || m === "collapsed" || m === "hover" ? m : localStorage.getItem("orbit-side-wide") === "1" ? "expanded" : "hover"; } catch { return "hover"; } });
  const chooseSide = (m: SideMode) => { setSideMode(m); setSideMenu(false); try { localStorage.setItem("orbit-side-mode", m); } catch { /* ignore */ } };
  const [sideMenu, setSideMenu] = useState(false);
  useEffect(() => {
    if (!sideMenu) return;
    const away = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest?.(".side-mode")) setSideMenu(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setSideMenu(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [sideMenu]);
  const onClub = /\/campus\/clubs\//.test(loc.pathname); // club pages have a channel list of their own, so the bar never pushes them
  const sideClass = sideMode === "expanded" && onClub ? "hover" : sideMode;
  const keyFor = (to: string) => Object.entries(GO).find(([, v]) => v.to === to)?.[0];

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
  const [startAt, setStartAt] = useState<Community | undefined>(undefined);
  const newPost = () => { setStartAt(undefined); setComposing(true); };
  // A page can ask for the new-post window (the feed does on a phone, where the post box is this window), naming who it is for.
  useEffect(() => {
    const open = (e: Event) => { setStartAt((e as CustomEvent<{ community?: Community }>).detail?.community); setComposing(true); };
    window.addEventListener("orbit-compose", open);
    return () => window.removeEventListener("orbit-compose", open);
  }, []);

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
  const tabs = items.filter((i) => ["/app/feed", "/app/chats", "/app/plans", "/app/sync", "/app/campus"].includes(i.to));

  return (
    <div className={"shell side-" + sideClass + (hideTop ? " hide-top" : "")}>
      <a className="skip" href="#main">Skip to content</a>
      <aside className="side" aria-label="Main">
        <div className="side-top">
          <NavLink to="/app/feed" className="logo logo-toggle" aria-label="Orbit, home"><Orb variant="light" mood={logoMood} onPoke={wake} /><span className="navtext">Orbit</span></NavLink>
        </div>
        <nav className="navgroup" aria-label="Primary">
          {items.map((i) => {
            const k = keyFor(i.to);
            return (
              <NavLink key={i.to} to={i.to} title={k ? `${i.label} · G then ${k.toUpperCase()}` : i.label} aria-label={i.label} className={({ isActive }) => "navlink" + (isActive ? " active" : "")}>
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId="side-indicator" className="navpill" transition={slide} />}
                    <i.icon size={22} strokeWidth={1.75} />
                    <span className="navtext">{i.label}</span>
                    {i.to === "/app/chats" && unread > 0 && <span className="nav-count" role="img" aria-label={`${unread} unread ${unread === 1 ? "message" : "messages"}`}>{unread > 9 ? "9+" : unread}</span>}
                    {i.to === "/app/plans" && waiting > 0 && <span className="nav-dot" role="img" aria-label={waiting === 1 ? "1 hangout needs your answer" : `${waiting} hangouts need your answer`} />}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
        <button className="compose-btn solo" title="New post · N" aria-label="New post" onClick={newPost}><SquarePen size={22} strokeWidth={1.9} aria-hidden="true" /><span className="navtext">New post</span></button>
        <span className="spacer" />
        <div className="side-utils" role="group" aria-label="Settings">
          <button className="navlink extra" title="Keyboard shortcuts · ?" aria-label="Keyboard shortcuts" onClick={() => window.dispatchEvent(new CustomEvent("orbit-shortcuts"))}>
            <Keyboard size={22} strokeWidth={1.75} />
            <span className="navtext">Shortcuts</span>
          </button>
          <button className="navlink extra" title={dark ? "Switch to light mode" : "Switch to dark mode"} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={dark} onClick={() => setTheme(dark ? "light" : "dark")}>
            {dark ? <Sun size={22} strokeWidth={1.75} /> : <Moon size={22} strokeWidth={1.75} />}
            <span className="navtext">{dark ? "Light mode" : "Dark mode"}</span>
          </button>
          <button className="navlink extra" title="Sign out" aria-label="Sign out" onClick={async () => { await signOut(); nav("/login", { replace: true }); }}>
            <LogOut size={22} strokeWidth={1.75} />
            <span className="navtext">Sign out</span>
          </button>
          <div className="side-mode">
            <button type="button" className="navlink extra" title="Sidebar control" aria-haspopup="menu" aria-expanded={sideMenu} onClick={() => setSideMenu((v) => !v)}>
              <PanelLeft size={22} strokeWidth={1.75} />
              <span className="navtext">Sidebar</span>
            </button>
            {sideMenu && (
              <div className="side-menu" role="menu" aria-label="Sidebar control">
                <p>Sidebar control</p>
                {SIDE_MODES.map((m) => (
                  <button key={m.id} type="button" role="menuitemradio" aria-checked={sideMode === m.id} onClick={() => chooseSide(m.id)}>
                    <span>{m.label}</span>{sideMode === m.id && <Check size={16} aria-hidden="true" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <NavLink to="/app/profile" title="Profile" aria-label="Profile" className="side-me"><span className="me-av">{name.slice(0, 1).toUpperCase()}</span><span className="navtext">Profile</span></NavLink>
      </aside>
      <div className="content">
        <div className="topline">
          <button type="button" className="logo logo-mobile" aria-label="Open menu" aria-expanded={drawer} onClick={() => setDrawer(true)}><Orb variant="violet" mood={logoMood} onPoke={wake} /></button>
          <span className="top-title" aria-hidden="true">{pageTitle}</span>
          <GlobalSearch />
          <NotificationBell />
          <NavLink to="/app/profile" title="Profile" aria-label="Profile" className="me topme">{name.slice(0, 1).toUpperCase()}</NavLink>
        </div>
        <motion.main key={loc.pathname} id="main" tabIndex={-1} ref={main} className="main" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={enter}>
          <Outlet />
        </motion.main>
      </div>
      <Assistant />
      <nav className="tabbar" aria-label="Main">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => "tab" + (isActive ? " active" : "")}>
            <span className="tab-ico"><t.icon size={22} strokeWidth={1.75} />
              {t.to === "/app/chats" && unread > 0 && <b className="tab-count" role="img" aria-label={`${unread} unread`}>{unread > 9 ? "9+" : unread}</b>}
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
            {i.to === "/app/chats" && unread > 0 && <b className="drawer-count">{unread > 9 ? "9+" : unread}</b>}
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
      <ComposeModal open={composing} initialCommunity={startAt} onClose={() => setComposing(false)} />
    </div>
  );
}
