import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CalendarClock, CalendarDays, GraduationCap, Heart, MapPinCheck, MessageCircle, MessageSquare, UserCheck, UserPlus, Users } from "lucide-react";
import { useAuth } from "../lib/auth";
import { isVisible, useHang, YOU } from "../lib/hangouts";
import { useNudges } from "../lib/nudges";
import { statusOf, useProposals } from "../lib/placeVotes";
import { loadProfile } from "../lib/profile";
import { dueAt, fromYmd, useReminders } from "../lib/reminders";
import { enter, exit } from "../lib/motion";
import { friendActions, useFriends } from "../lib/friends";
import { notifActions, useNotifs } from "../lib/notifs";
import { classesSoon, clockLabel, useClasses } from "../lib/classes";

type Row = { id: string; icon: typeof Bell; title: string; sub: string; go: () => void; unread?: boolean; request?: { id: string } };

const KIND_ICON: Record<string, typeof Bell> = { like: Heart, comment: MessageCircle, reply: MessageCircle, message: MessageSquare, friend_request: UserPlus, friend_accept: UserCheck, group_add: Users, event: CalendarDays };
const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};

/** What needs you, in one place: hangouts waiting on your answer, reminders that are due, and places on the map waiting for a vote.
 *  It is worked out from what is on the page, so it needs no server. Each kind can be turned off in Profile. */
export default function NotificationBell() {
  const { session } = useAuth();
  const nav = useNavigate();
  const nudges = useNudges(session?.user.id);
  const { groups, hangouts } = useHang();
  const reminders = useReminders();
  const proposals = useProposals();
  const notifs = useNotifs();
  const friends = useFriends();
  const classes = useClasses();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const campusKey = session ? loadProfile(session.user.id)?.campusKey : undefined;
  const rows: Row[] = [];
  const go = (to: string, state?: object) => () => { setOpen(false); nav(to, state ? { state } : undefined); };

  // From the database: replies, likes, messages, friend requests, being added to a group. Unread ones first, then a few recent ones you have seen.
  const social: Row[] = [...notifs.filter((n) => n.unread), ...notifs.filter((n) => !n.unread).slice(0, 4)].slice(0, 12).map((n) => ({
    id: `n-${n.id}`, icon: KIND_ICON[n.kind] ?? Bell, title: n.title, sub: n.sub ? `${n.sub} · ${ago(n.at)}` : ago(n.at), unread: n.unread,
    go: () => { notifActions.markRead(n.id); go(n.to)(); },
    request: n.kind === "friend_request" && n.actorId ? friends.incoming.find((r) => r.from.id === n.actorId) : undefined,
  }));
  rows.push(...social);
  const unreadSocial = notifs.filter((n) => n.unread).length;

  if (nudges.hangouts) {
    const waiting = hangouts.filter((h) => isVisible(h, groups) && !h.rsvps[YOU] && new Date(h.when).getTime() > now.getTime()).sort((a, b) => a.when.localeCompare(b.when));
    for (const h of waiting.slice(0, 4)) rows.push({ id: `h-${h.id}`, icon: Users, title: h.title, sub: `Needs your answer · ${new Date(h.when).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`, go: go("/app/plans", { day: new Date(h.when).toDateString() }) });
    if (waiting.length > 4) rows.push({ id: "h-more", icon: Users, title: `${waiting.length - 4} more hangouts`, sub: "Waiting for your answer", go: go("/app/feed") });
  }
  if (nudges.reminders) {
    const due = reminders.filter((r) => !r.done && dueAt(r).getTime() <= now.getTime()).sort((a, b) => dueAt(a).getTime() - dueAt(b).getTime());
    for (const r of due.slice(0, 4)) rows.push({ id: `r-${r.id}`, icon: CalendarClock, title: r.title, sub: `Reminder · ${fromYmd(r.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}${r.time ? `, ${r.time}` : ""}`, go: go("/app/plans", { day: fromYmd(r.date).toDateString() }) });
  }
  if (nudges.reminders) {
    // A class within the next hour (or just started).
    for (const c of classesSoon(classes, now).slice(0, 2)) {
      rows.push({ id: `c-${c.key}`, icon: GraduationCap, title: `${c.slot.name} ${c.minutes <= 0 ? "is starting" : c.minutes >= 55 ? "starts in about an hour" : `starts in ${c.minutes} min`}`, sub: `${clockLabel(c.slot.start)}${c.slot.place ? ` · ${c.slot.place}` : ""}`, go: go("/app/plans", { day: c.starts.toDateString() }) });
    }
  }
  if (nudges.places && campusKey) {
    const votes = proposals.filter((p) => p.campusKey === campusKey && statusOf(p) === "open" && p.by !== YOU && p.votes[YOU] === undefined);
    if (votes.length) rows.push({ id: "places", icon: MapPinCheck, title: `${votes.length} ${votes.length === 1 ? "place needs" : "places need"} your vote`, sub: "Students added them to the map", go: go("/app/map") });
  }
  const count = rows.length - social.filter((r) => !r.unread).length;

  return (
    <div className="bell-wrap" ref={root}>
      <button type="button" className="bell" aria-expanded={open} aria-haspopup="true" aria-label={count ? `Notifications, ${count} need you` : "Notifications, nothing new"} onClick={() => setOpen((v) => !v)}>
        <motion.span key={count} style={{ display: "inline-flex", transformOrigin: "50% 0" }} animate={{ rotate: count ? [0, -16, 12, -8, 0] : 0 }} transition={{ duration: 0.5 }}><Bell size={19} strokeWidth={1.9} aria-hidden="true" /></motion.span>
        {count > 0 && <span className="bell-count" aria-hidden="true">{count > 9 ? "9+" : count}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="bell-pop" role="region" aria-label="Notifications" initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1, transition: enter }} exit={{ opacity: 0, y: -6, transition: exit }}>
            {count === 0 ? (
              <p className="bell-empty">You are all caught up.</p>
            ) : (
              <ul>
                {rows.map((r) => (
                  <li key={r.id} className={r.unread === false ? "seen" : undefined}>
                    <button type="button" onClick={r.go}>
                      <span className="bell-ico" aria-hidden="true"><r.icon size={16} strokeWidth={1.9} /></span>
                      <span className="bell-text"><strong>{r.title}</strong><em>{r.sub}</em></span>
                    </button>
                    {r.request && (
                      <div className="bell-actions">
                        <button type="button" className="btn primary" onClick={async () => friendActions.tell(await friendActions.accept(r.request!.id), "Could not accept")}>Accept</button>
                        <button type="button" className="btn" onClick={async () => friendActions.tell(await friendActions.ignore(r.request!.id), "Could not ignore")}>Ignore</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {unreadSocial > 0 && <button type="button" className="bell-settings" onClick={() => notifActions.markAllRead()}>Mark all as read</button>}
            <Link to="/app/profile" className="bell-settings" onClick={() => setOpen(false)}>Notification settings</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
