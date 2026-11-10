import { motion, useReducedMotion } from "framer-motion";

/** The row of dots at the top of setup. One ring glides from dot to dot (forward or back) instead of disappearing and reappearing, finished steps fill. */
export default function OrbitProgress({ steps, index, total }: { steps: string[]; index: number; total: number }) {
  const reduce = useReducedMotion();
  return (
    <ol className="onb-progress" aria-label={`Step ${index + 1} of ${total}`}>
      {steps.map((s, n) => (
        <li key={s} className={n < index ? "done" : n === index ? "now" : ""} aria-current={n === index ? "step" : undefined}>
          <span className="dot" />
          {n === index && <motion.span layoutId="onb-mark" className="mark" transition={reduce ? { duration: 0.1 } : { type: "spring", stiffness: 420, damping: 32 }} />}
        </li>
      ))}
    </ol>
  );
}
