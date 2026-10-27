import { AnimatePresence, motion } from "framer-motion";
import { CalendarX2, CircleAlert, Pin, WifiOff, X, type LucideIcon } from "lucide-react";
import { notice, useNotices, type NoticeIcon } from "../lib/notice";
import { enter, exit } from "../lib/motion";
import Orb from "./Orb";

const ICONS: Record<NoticeIcon, LucideIcon> = { pin: Pin, calendar: CalendarX2, alert: CircleAlert, wifi: WifiOff };

/** The popups for blocked or failed actions. They sit at the top, announce themselves to screen readers, and close on their own. */
export default function NoticeHost() {
  const items = useNotices();
  return (
    <div className="notice-wrap" role="alert" aria-live="assertive">
      <AnimatePresence>
        {items.map((n) => {
          const Icon = ICONS[n.icon];
          return (
            <motion.div key={n.id} className="notice" layout initial={{ opacity: 0, y: -16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1, transition: enter }} exit={{ opacity: 0, y: -10, transition: exit }}>
              {n.icon === "alert" || n.icon === "wifi" ? <span className="notice-ico" aria-hidden="true"><Icon size={18} strokeWidth={2} /></span> : <Orb variant="violet" mood="happy" poke={false} />}
              <div className="notice-text">
                <strong>{n.title}</strong>
                <p>{n.message}</p>
                {n.actions.length > 0 && (
                  <div className="notice-actions">
                    {n.actions.map((a) => <button key={a.label} type="button" onClick={() => { a.onClick(); notice.dismiss(n.id); }}>{a.label}</button>)}
                  </div>
                )}
              </div>
              <button type="button" className="notice-x" aria-label="Dismiss" onClick={() => notice.dismiss(n.id)}><X size={16} aria-hidden="true" /></button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
