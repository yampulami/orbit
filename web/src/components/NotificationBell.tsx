import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CalendarClock, MapPinCheck, Users } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useHang, YOU } from "../lib/hangouts";
import { useNudges } from "../lib/nudges";
import { statusOf, useProposals } from "../lib/placeVotes";
import { loadProfile } from "../lib/profile";
import { dueAt, fromYmd, useReminders } from "../lib/reminders";
import { enter, exit } from "../lib/motion";

type Row = { id: string; icon: typeof Bell; title: string; sub: string; go: () => void };

/** What needs you, in one place: hangouts waiting on your answer, reminders that are due, and places on the map waiting for a vote.
 *  It is worked out from what is on the page, so it needs no server. Each kind can be turned off in Profile. */
export default function NotificationBell() {
  const { session } = useAuth();
  const nav = useNavigate();
  const nudges = useNudges(session?.user.id);
  const { groups, hangouts } = useHang();
  const reminders = useReminders();
  const proposals = useProposals();
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

  if (nudges.hangouts) {
    const waiting = hangouts.filter((h) => !h.canceled && !h.rsvps[YOU] && new Date(h.when).getTime() > now.getTime() && groups.some((g) => g.id === h.groupId)).sort((a, b) => a.when.localeCompare(b.when));
    for (const h of waiting.slice(0, 4)) rows.push({ id: `h-${h.id}`, icon: Users, title: h.title, sub: `Needs your answer · ${new Date(h.when).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`, go: go("/app/plans", { day: new Date(h.when).toDateString() }) });
    if (waiting.length > 4) rows.push({ id: "h-more", icon: Users, title: `${waiting.length - 4} more hangouts`, sub: "Waiting for your answer", go: go("/app/feed") });
  }
  if (nudges.reminders) {
    const due = reminders.filter((r) => !r.done && dueAt(r).getTime() <= now.getTime()).sort((a, b) => dueAt(a).getTime() - dueAt(b).getTime());
    for (const r of due.slice(0, 4)) rows.push({ id: `r-${r.id}`, icon: CalendarClock, title: r.title, sub: `Reminder · ${fromYmd(r.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}${r.time ? `, ${r.time}` : ""}`, go: go("/app/plans", { day: fromYmd(r.date).toDateString() }) });
  }
  if (nudges.places && campusKey) {
    const votes = proposals.filter((p) => p.campusKey === campusKey && statusOf(p) === "open" && p.by !== YOU && p.votes[YOU] === undefined);
    if (votes.length) rows.push({ id: "places", icon: MapPinCheck, title: `${votes.length} ${votes.length === 1 ? "place needs" : "places need"} your vote`, sub: "Students added them to the map", go: go("/app/map") });
  }
  const count = rows.length;

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
                  <li key={r.id}>
                    <button type="button" onClick={r.go}>
                      <span className="bell-ico" aria-hidden="true"><r.icon size={16} strokeWidth={1.9} /></span>
                      <span className="bell-text"><strong>{r.title}</strong><em>{r.sub}</em></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/app/profile" className="bell-settings" onClick={() => setOpen(false)}>Notification settings</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
