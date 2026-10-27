import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, X } from "lucide-react";
import { dueAt, dueNow, reminderActions, useReminders } from "../lib/reminders";
import { enter, exit } from "../lib/motion";
import { useAuth } from "../lib/auth";
import { useNudges } from "../lib/nudges";
import { notifyDevice } from "../lib/deviceAlerts";

/** Pops up a reminder when its time comes while Orbit is open. Done, snooze for 10 minutes, or close it. */
export default function ReminderAlerts() {
  const reminders = useReminders();
  const { session } = useAuth();
  const wantsReminders = useNudges(session?.user.id).reminders;
  const [shown, setShown] = useState<string[]>([]);

  useEffect(() => {
    const check = () => {
      const now = new Date();
      const due = dueNow(reminders, now);
      if (due.length === 0) return;
      const fresh: string[] = [];
      for (const r of due) {
        reminderActions.markNotified(r.id);
        // Something that came due while Orbit was closed days ago is not worth a pop-up.
        if (wantsReminders && now.getTime() - dueAt(r).getTime() < 24 * 3600000) { fresh.push(r.id); void notifyDevice(r.title, "Reminder from Orbit", `reminder-${r.id}`); }
      }
      if (fresh.length) setShown((s) => [...new Set([...s, ...fresh])]); // a set, because React may run this twice in development
    };
    check();
    const t = setInterval(check, 15000);
    return () => clearInterval(t);
  }, [reminders, wantsReminders]);

  const items = shown.map((id) => reminders.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r && !r.done);
  const close = (id: string) => setShown((s) => s.filter((x) => x !== id));

  return (
    <div className="rem-alerts" role="status" aria-live="assertive">
      <AnimatePresence>
        {items.map((r) => (
          <motion.div key={r.id} className="rem-alert" layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0, transition: enter }} exit={{ opacity: 0, y: 8, transition: exit }}>
            <span className="rem-alert-ico" aria-hidden="true"><Bell size={18} strokeWidth={1.9} /></span>
            <div className="rem-alert-text"><strong>{r.title}</strong><span>Reminder</span></div>
            <div className="rem-alert-actions">
              <button type="button" onClick={() => { reminderActions.setDone(r.id, true); close(r.id); }}>Done</button>
              <button type="button" onClick={() => { reminderActions.snooze(r.id, 10); close(r.id); }}>Snooze 10 min</button>
            </div>
            <button type="button" className="rem-alert-x" aria-label="Dismiss" onClick={() => close(r.id)}><X size={16} aria-hidden="true" /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
