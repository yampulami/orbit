import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { arrival, useArrival } from "../lib/arrival";
import { hangLive, useHangStatus } from "../lib/hangouts";
import Orb from "./Orb";

const MIN_MS = 3200;   // long enough to enjoy the animation and read the lines, short enough not to drag
/** The lines change as it goes, so a longer wait still feels like something is happening. It stops on the last one if loading takes longer. */
const LINES = ["Loading your Orbit", "Finding your campus", "Setting things up", "Almost there"];
const LINE_MS = 1000;
const MAX_MS = 9000;   // never trap anyone behind it if something takes too long

/** Shown right after onboarding: the page turns violet, a small Orbit mark circles, and "Your Orbit is loading" appears. When the app is ready it
 *  fades away into it. The violet circle that grew from the "Take me in" button hands over to this without a gap. */
export default function ArrivalScreen() {
  const { active, shellReady } = useArrival();
  const hang = useHangStatus();
  const reduce = useReducedMotion();
  const [waited, setWaited] = useState(false);
  const [out, setOut] = useState(false);
  const [line, setLine] = useState(0);

  useEffect(() => {
    if (!active) { setLine(0); return; }
    if (reduce) return;
    const tick = setInterval(() => setLine((n) => Math.min(n + 1, LINES.length - 1)), LINE_MS);
    return () => clearInterval(tick);
  }, [active, reduce]);

  useEffect(() => {
    if (!active) { setWaited(false); return; }
    const min = setTimeout(() => setWaited(true), reduce ? 500 : MIN_MS);
    const max = setTimeout(() => setOut(true), MAX_MS);
    return () => { clearTimeout(min); clearTimeout(max); };
  }, [active, reduce]);

  // With a database, groups and plans load as the app opens; wait for them so the first thing you see is filled in.
  const loaded = shellReady && (!hangLive || hang === "ready" || hang === "error");
  useEffect(() => { if (active && waited && loaded) setOut(true); }, [active, waited, loaded]);

  const ease = [0.16, 1, 0.3, 1] as const;
  return (
    <AnimatePresence onExitComplete={() => { setOut(false); arrival.end(); }}>
      {active && !out && (
        <motion.div key="arrival" className="arrival" role="status" aria-live="polite"
          initial={{ opacity: reduce ? 0 : 1 }} animate={{ opacity: 1, transition: { duration: 0.3 } }} exit={{ opacity: 0, transition: { duration: reduce ? 0.2 : 0.7, ease } }}>
          <motion.div className="arrival-mark" initial={reduce ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={reduce ? undefined : { scale: 1.35, opacity: 0 }} transition={{ duration: 0.7, ease, delay: 0.1 }}>
            <svg viewBox="0 0 240 240" width="190" height="190" aria-hidden="true">
              <circle cx="120" cy="120" r="54" fill="none" stroke="#fff" strokeOpacity="0.42" strokeWidth="2" />
              <circle cx="120" cy="120" r="80" fill="none" stroke="#fff" strokeOpacity="0.26" strokeWidth="2" />
              <circle cx="120" cy="120" r="106" fill="none" stroke="#fff" strokeOpacity="0.14" strokeWidth="2" />
              {/* the campus at the centre, breathing gently */}
              {/* one dot on each ring, starting in different places, at different speeds; the middle one goes the other way. Fixed bright colours so they show on violet in light and dark mode. */}
              <motion.g style={{ transformOrigin: "120px 120px" }} animate={reduce ? undefined : { rotate: 360 }} transition={{ repeat: Infinity, ease: "linear", duration: 2.2 }}>
                <circle cx="120" cy="66" r="9" fill="#ffb8d9" />
              </motion.g>
              <motion.g style={{ transformOrigin: "120px 120px" }} animate={reduce ? undefined : { rotate: -360 }} transition={{ repeat: Infinity, ease: "linear", duration: 3.6 }}>
                <circle cx="120" cy="200" r="7" fill="#ffe6a3" />
              </motion.g>
              <motion.g style={{ transformOrigin: "120px 120px" }} animate={reduce ? undefined : { rotate: 360 }} transition={{ repeat: Infinity, ease: "linear", duration: 5.4 }}>
                <circle cx="14" cy="120" r="5.5" fill="#a9ecd0" />
              </motion.g>
            </svg>
            <Orb size={56} variant="light" mood="loading" className="arrival-orb" poke={false} />
          </motion.div>
          <div className="arrival-text-wrap" aria-hidden="true">
            <AnimatePresence mode="wait">
              <motion.p key={line} className="arrival-text" initial={{ opacity: 0, y: reduce ? 0 : 8 }} animate={{ opacity: 0.9, y: 0 }} exit={{ opacity: 0, y: reduce ? 0 : -8 }} transition={{ duration: 0.35, ease, delay: line === 0 ? 0.45 : 0 }}>{LINES[line]}</motion.p>
            </AnimatePresence>
          </div>
          <span className="sr">Your Orbit is loading</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
