import { AnimatePresence, motion } from "framer-motion";
import { undo, useUndo } from "../lib/undo";
import { enter, exit } from "../lib/motion";

/** Shows "Post deleted. Undo" for a few seconds after something is removed. */
export default function UndoToast() {
  const items = useUndo();
  return (
    <div className="undo-wrap" role="status" aria-live="polite">
      <AnimatePresence>
        {items.map((it) => (
          <motion.div key={it.id} className="undo" layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0, transition: enter }} exit={{ opacity: 0, y: 8, transition: exit }}>
            <span>{it.message}</span>
            <button type="button" onClick={() => undo.undo(it.id)}>Undo</button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
