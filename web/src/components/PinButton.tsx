import { motion } from "framer-motion";
import { Pin } from "lucide-react";
import { MAX_PINS, pinActions, usePins, type PinKind } from "../lib/pins";
import { notice } from "../lib/notice";

/** A small pin toggle. Three pins at most, so "very important" stays rare. */
export default function PinButton({ kind, id, title }: { kind: PinKind; id: string; title: string }) {
  const pins = usePins();
  const on = pins.some((p) => p.kind === kind && p.id === id);
  function click() {
    const r = pinActions.toggle({ kind, id }, title);
    if (r === "full") notice.show({ icon: "pin", title: "Your pins are full", message: `You can pin up to ${MAX_PINS} things so the important ones stay easy to spot. Unpin one to make room for "${title}".` });
  }
  return (
    <span className="pin-wrap">
      <button type="button" className="pin-btn" aria-pressed={on} aria-label={on ? `Unpin ${title}` : `Pin ${title}`} title={on ? "Unpin" : "Pin to the top of Home"} onClick={click}>
        <motion.span key={on ? "on" : "off"} style={{ display: "inline-flex" }} initial={on ? { rotate: 30, scale: 0.6 } : false} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 520, damping: 20 }}>
          <Pin size={15} strokeWidth={2} aria-hidden="true" fill={on ? "currentColor" : "none"} />
        </motion.span>
      </button>
    </span>
  );
}
