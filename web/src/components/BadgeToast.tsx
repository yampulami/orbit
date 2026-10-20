import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import BadgeIcon from "./BadgeIcon";
import { badges, progress, useProgress } from "../lib/progress";
import { enter, exit } from "../lib/motion";

/** One quiet note when a badge is earned. */
export default function BadgeToast() {
  const { toast } = useProgress();
  const id = toast[0];
  const badge = badges.find((b) => b.id === id);

  useEffect(() => {
    if (!id) return;
    const t = setTimeout(progress.dismissToast, 4500);
    return () => clearTimeout(t);
  }, [id]);

  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      <AnimatePresence>
        {badge && (
          <motion.div key={badge.id} className="toast" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0, transition: enter }} exit={{ opacity: 0, y: 8, transition: exit }}>
            <BadgeIcon icon={badge.icon} area={badge.area} size={48} />
            <div><strong>{badge.name}</strong><span>{badge.hint}</span></div>
            <button type="button" aria-label="Dismiss" onClick={progress.dismissToast}>×</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
