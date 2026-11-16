import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { arrival, useArrival } from "../lib/arrival";
import { hangLive, useHangStatus } from "../lib/hangouts";
import Orb from "./Orb";
import ArrivalWalker from "./ArrivalWalker";

/** It stays up for somewhere between 5 and 10 seconds (picked each time), long enough to watch Omega walk and read the lines. */
const MIN_FROM = 5000, MIN_TO = 10000;
/** The lines change as it goes, so a long wait still feels like something is happening. It stops on the last one if loading takes longer. */
const LINES = ["Loading your Orbit", "Finding your campus", "Setting things up", "Walking your feed over", "Tidying up", "Almost there"];
const LINE_MS = 1500;
const MAX_MS = 14000;  // never trap anyone behind it if something takes too long

/** Shown right after onboarding: the page turns violet, a small Orbit mark circles, and "Your Orbit is loading" appears. When the app is ready it
 *  fades away into it. The violet circle that grew from the "Take me in" button hands over to this without a gap. */
export default function ArrivalScreen() {
  const { active, shellReady } = useArrival();
  const hang = useHangStatus();
  const reduce = useReducedMotion();
  const [waited, setWaited] = useState(false);
  const [out, setOut] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [line, setLine] = useState(0);
  const minMs = useRef(MIN_FROM);

  useEffect(() => {
    if (!active) { setLine(0); return; }
    if (reduce) return;
    const tick = setInterval(() => setLine((n) => Math.min(n + 1, LINES.length - 1)), LINE_MS);
    return () => clearInterval(tick);
  }, [active, reduce]);

  useEffect(() => {
    if (!active) { setWaited(false); setLeaving(false); return; }
    minMs.current = MIN_FROM + Math.random() * (MIN_TO - MIN_FROM);
    const min = setTimeout(() => setWaited(true), reduce ? 500 : minMs.current);
    const max = setTimeout(() => setOut(true), MAX_MS);
    return () => { clearTimeout(min); clearTimeout(max); };
  }, [active, reduce]);

  // With a database, groups and plans load as the app opens; wait for them so the first thing you see is filled in.
  const loaded = shellReady && (!hangLive || hang === "ready" || hang === "error");
  // when everything is ready Omega says goodbye (see ArrivalWalker); the screen starts fading while he is in the air, and `onFade` below is what sets `out`
  useEffect(() => { if (active && waited && loaded) setLeaving(true); }, [active, waited, loaded]);

  const ease = [0.16, 1, 0.3, 1] as const;
  return (
    <AnimatePresence onExitComplete={() => { setOut(false); arrival.end(); }}>
      {active && !out && (
        <motion.div key="arrival" className="arrival" role="status" aria-live="polite"
          initial={{ opacity: reduce ? 0 : 1 }} animate={{ opacity: 1, transition: { duration: 0.3 } }} exit={{ opacity: 0, transition: { duration: reduce ? 0.2 : 0.7, ease } }}>
          <motion.div className="arrival-mark" initial={reduce ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={reduce ? undefined : { scale: 1.35, opacity: 0 }} transition={{ duration: 0.7, ease, delay: 0.1 }}>
            <ArrivalWalker leaving={leaving} onFade={() => setOut(true)} onLanded={() => arrival.landed()} fallback={<Orb size={56} variant="light" mood="loading" className="arrival-orb arrival-orb-solo" poke={false} />} />
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
