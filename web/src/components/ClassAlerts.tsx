import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GraduationCap, X } from "lucide-react";
import { classesSoon, clockLabel, useClasses } from "../lib/classes";
import { enter, exit } from "../lib/motion";
import { useAuth } from "../lib/auth";
import { useNudges } from "../lib/nudges";
import { notifyDevice } from "../lib/deviceAlerts";
import { haptic } from "../lib/haptics";

const SEEN = "orbit-class-alerted";
const seenKeys = (): string[] => { try { const l = JSON.parse(localStorage.getItem(SEEN) ?? "[]") as unknown; return Array.isArray(l) ? l.filter((x): x is string => typeof x === "string") : []; } catch { return []; } };
const remember = (k: string) => { try { localStorage.setItem(SEEN, JSON.stringify([...seenKeys(), k].slice(-120))); } catch { /* ignore */ } };

/** An hour before a class, a card pops up (and the device shows an alert if those are on), once for each class meeting. It works while Orbit is open,
 *  in a tab or window, like reminders do. */
export default function ClassAlerts() {
  const classes = useClasses();
  const { session } = useAuth();
  const wants = useNudges(session?.user.id).reminders;
  const [cards, setCards] = useState<{ key: string; name: string; sub: string; minutes: number }[]>([]);

  useEffect(() => {
    if (!wants || classes.length === 0) return;
    const check = () => {
      const seen = new Set(seenKeys());
      const fresh = classesSoon(classes, new Date()).filter((c) => !seen.has(c.key));
      if (!fresh.length) return;
      for (const c of fresh) {
        remember(c.key);
        const when = c.minutes <= 0 ? "starting now" : c.minutes >= 55 ? "in 1 hour" : `in ${c.minutes} min`;
        void notifyDevice(`${c.slot.name} ${when}`, `${clockLabel(c.slot.start)}${c.slot.place ? ` · ${c.slot.place}` : ""}`, `class-${c.key}`);
      }
      haptic("receive");
      setCards((l) => {
        const have = new Set(l.map((x) => x.key));
        return [...l, ...fresh.filter((c) => !have.has(c.key)).map((c) => ({ key: c.key, name: c.slot.name, sub: `${clockLabel(c.slot.start)}${c.slot.place ? ` · ${c.slot.place}` : ""}`, minutes: c.minutes }))];
      });
    };
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, [classes, wants]);

  return (
    <div className="rem-alerts class-alerts" role="status" aria-live="polite">
      <AnimatePresence>
        {cards.map((c) => (
          <motion.div key={c.key} className="rem-alert" layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0, transition: enter }} exit={{ opacity: 0, y: 8, transition: exit }}>
            <span className="rem-alert-ico class" aria-hidden="true"><GraduationCap size={18} strokeWidth={1.9} /></span>
            <div className="rem-alert-text"><strong>{c.name}</strong><span>{c.minutes <= 0 ? "Starting now" : c.minutes >= 55 ? "Starts in about an hour" : `Starts in ${c.minutes} min`} · {c.sub}</span></div>
            <button type="button" className="rem-alert-x" aria-label="Dismiss" onClick={() => setCards((l) => l.filter((x) => x.key !== c.key))}><X size={16} aria-hidden="true" /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
