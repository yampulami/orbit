import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/** Right after onboarding the page is still covered by the violet circle that grew from the "Take me in" button. It shrinks back to that spot, revealing the app. */
export default function Arrival() {
  const reduce = useReducedMotion();
  const [gone, setGone] = useState(false);
  let at: string | null = null;
  try { at = sessionStorage.getItem("orbit-arrival"); } catch { /* ignore */ }
  const clear = () => { try { sessionStorage.removeItem("orbit-arrival"); } catch { /* ignore */ } setGone(true); };
  if (!at || gone || reduce) { if (at && reduce) clear(); return null; }
  const [x, y] = at.split(",").map(Number);
  return <motion.div className="onb-wipe" aria-hidden="true" initial={{ clipPath: `circle(150vmax at ${x}px ${y}px)` }} animate={{ clipPath: `circle(0px at ${x}px ${y}px)` }} transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1], delay: 0.1 }} onAnimationComplete={clear} />;
}
