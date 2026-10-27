import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCheer } from "../lib/cheer";
import Orb from "./Orb";

/** Where the orb's celebration appears: a small bubble above the tab bar (or low on a computer) that pops in, cheers and leaves by itself. */
export default function CheerHost() {
  const c = useCheer();
  const reduce = useReducedMotion();
  return (
    <div className="cheer-wrap" role="status" aria-live="polite">
      <AnimatePresence>
        {c && (
          <motion.div key={c.id} className="cheer" initial={reduce ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.7 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: reduce ? 0 : 16, scale: reduce ? 1 : 0.9 }} transition={{ type: "spring", stiffness: 420, damping: 22 }}>
            <Orb size={46} variant="violet" mood="excited" poke={false} />
            <span className="cheer-text">{c.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
