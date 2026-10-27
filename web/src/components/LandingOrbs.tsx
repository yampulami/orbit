import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import OrbGL from "./OrbGL";

/** Purple stays the main colour of each; the other two stops are neighbours on the colour wheel (blue, magenta, red, orange). */
const ORBS = [
  { colors: ["#6A4DE8", "#3E63F0", "#FF7A59"], size: 1, lift: 0 },
  { colors: ["#7C5CFF", "#E0529C", "#FFB067"], size: 1.22, lift: -22 },
  { colors: ["#5B3FD9", "#2F8CFF", "#FF5E6C"], size: 1, lift: 0 },
];
const REACH = 280;

/** The three orbs on the landing page. Each opens its eyes wide when the pointer is over it, and all three get more excited the closer the pointer comes
 *  to the sign-up and "see what's inside" buttons (anything marked data-cta). A tap does the same on a touch screen. They stay where they are;
 *  excitement is shown in the eyes only, eased up and down so it never snaps. */
export default function LandingOrbs() {
  const reduce = useReducedMotion();
  const near = useRef(0);
  const over = useRef<number | null>(null);
  const poked = useRef<{ i: number; until: number } | null>(null);
  const [joys, setJoys] = useState([0, 0, 0]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      let d = Infinity;
      document.querySelectorAll("[data-cta]").forEach((el) => {
        const r = el.getBoundingClientRect();
        const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
        const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
        d = Math.min(d, Math.hypot(dx, dy));
      });
      near.current = Math.max(0, Math.min(1, 1 - d / REACH));
    };
    window.addEventListener("pointermove", move, { passive: true });

    const joy = [0, 0, 0];
    const shown = [0, 0, 0];
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let changed = false;
      for (let i = 0; i < 3; i++) {
        const hot = over.current === i || (poked.current?.i === i && now < poked.current.until);
        const target = reduce ? 0 : hot ? 1 : near.current * 0.8;
        joy[i] += (target - joy[i]) * Math.min(1, dt * 7);
        const r = Math.round(joy[i] * 20) / 20;
        if (r !== shown[i]) { shown[i] = r; changed = true; }
      }
      if (changed) setJoys([...shown]);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { window.removeEventListener("pointermove", move); cancelAnimationFrame(raf); };
  }, [reduce]);

  return (
    <div className="land-orbs" aria-hidden="true">
      {ORBS.map((o, i) => (
        <div
          key={i}
          className="land-orb"
          style={{ ["--s" as string]: o.size, marginTop: o.lift }}
          onPointerEnter={() => { over.current = i; }}
          onPointerLeave={() => { if (over.current === i) over.current = null; }}
          onPointerDown={() => { poked.current = { i, until: performance.now() + 1100 }; }}
        >
          <OrbGL size={190} colors={o.colors} joy={joys[i]} />
        </div>
      ))}
    </div>
  );
}
