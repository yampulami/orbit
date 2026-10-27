import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import OrbGL from "./OrbGL";

/** Purple stays the main colour of each; the other two stops are neighbours on the colour wheel (blue, magenta, red, orange). */
const ORBS = [
  { colors: ["#6A4DE8", "#3E63F0", "#FF7A59"], size: 1, lift: 0 },
  { colors: ["#7C5CFF", "#E0529C", "#FFB067"], size: 1.22, lift: -22 },
  { colors: ["#5B3FD9", "#2F8CFF", "#FF5E6C"], size: 1, lift: 0 },
];
const REACH = 280;

/** The three orbs on the landing page. Each jumps and opens its eyes wide when the pointer is over it, and all three get more excited the closer
 *  the pointer comes to the sign-up and "see what's inside" buttons (anything marked data-cta). A tap does the same on a touch screen. */
export default function LandingOrbs() {
  const reduce = useReducedMotion();
  const [near, setNear] = useState(0);
  const [over, setOver] = useState<number | null>(null);
  const [poked, setPoked] = useState<number | null>(null);
  const timer = useRef(0);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      let d = Infinity;
      document.querySelectorAll("[data-cta]").forEach((el) => {
        const r = el.getBoundingClientRect();
        const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
        const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
        d = Math.min(d, Math.hypot(dx, dy));
      });
      const next = Math.max(0, Math.min(1, 1 - d / REACH));
      setNear((n) => (Math.abs(n - next) > 0.06 ? Number(next.toFixed(2)) : n));
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  const poke = (i: number) => {
    setPoked(i);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPoked(null), 1100);
  };

  return (
    <div className="land-orbs" aria-hidden="true">
      {ORBS.map((o, i) => {
        const hot = over === i || poked === i;
        const joy = hot ? 1 : near;
        const excited = joy > 0.3;
        return (
          <motion.div
            key={i}
            className="land-orb"
            style={{ ["--s" as string]: o.size, marginTop: o.lift }}
            onPointerEnter={() => setOver(i)}
            onPointerLeave={() => setOver((v) => (v === i ? null : v))}
            onPointerDown={() => poke(i)}
            animate={reduce || !excited ? { y: 0, scaleX: 1, scaleY: 1 } : { y: [0, -(16 + 40 * joy), 0], scaleX: [1, 0.96, 1.05], scaleY: [1, 1.05, 0.92] }}
            transition={reduce || !excited ? { type: "spring", stiffness: 260, damping: 18 } : { duration: Math.max(0.42, 0.95 - 0.5 * joy), repeat: Infinity, ease: "easeOut", delay: i * 0.1 }}
          >
            <OrbGL size={190} colors={o.colors} joy={joy} />
          </motion.div>
        );
      })}
    </div>
  );
}
