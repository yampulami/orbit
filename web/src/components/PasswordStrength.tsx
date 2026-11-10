// Password strength meter, from 21st.dev ("Password Strength" by ddoemonn), adapted for Orbit: plain CSS in Orbit's colours (no red, amber and green),
// framer-motion, and rules that match what Orbit really asks for. Bars fill on springs; the word and ticks crossfade; screen readers hear a settled summary.
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { guessable, passwordRules, strengthLabels, strengthScore } from "../lib/passwordStrength";

const CELL = { type: "spring", stiffness: 520, damping: 34, mass: 0.45 } as const;
const FADE = { type: "spring", stiffness: 260, damping: 34, mass: 0.8 } as const;
const INSTANT = { duration: 0 } as const;

export default function PasswordStrength({ value, showRules = true }: { value: string; showRules?: boolean }) {
  const reduced = useReducedMotion();
  const max = passwordRules.length;
  const score = strengthScore(value);
  const bad = guessable(value);
  const at = Math.min(score, strengthLabels.length - 1);
  const label = strengthLabels[at];
  const tone = score === 0 ? "none" : score / max <= 0.34 ? "weak" : score / max <= 0.67 ? "fair" : "strong";
  const evaluated = useMemo(() => passwordRules.map((r) => ({ ...r, met: r.test(value) })), [value]);
  const said = !value ? "" : [`Password strength ${label.toLowerCase()}.`, bad ? "This is a commonly guessed pattern." : "", evaluated.every((r) => r.met) ? "All suggestions met." : `Still missing: ${evaluated.filter((r) => !r.met).map((r) => r.label.toLowerCase()).join(", ")}.`].filter(Boolean).join(" ");
  const [settled, setSettled] = useState("");
  useEffect(() => {
    if (!said) { setSettled(""); return; }
    const t = setTimeout(() => setSettled(said), 700);
    return () => clearTimeout(t);
  }, [said]);

  return (
    <div className={`pws pws-${tone}`}>
      <div className="pws-bars" role="meter" aria-label="Password strength" aria-valuemin={0} aria-valuemax={max} aria-valuenow={score} aria-valuetext={label} style={{ gridTemplateColumns: `repeat(${max}, minmax(0, 1fr))` }}>
        {Array.from({ length: max }, (_, i) => (
          <div key={i} className="pws-cell">
            <motion.span className="pws-fill" initial={false} animate={{ scaleX: i < score ? 1 : 0 }} transition={reduced ? INSTANT : { ...CELL, delay: i < score ? i * 0.03 : 0 }} />
          </div>
        ))}
      </div>
      <div className="pws-line">
        <span className="pws-words">
          {strengthLabels.map((t, i) => (
            <motion.span key={t} aria-hidden="true" initial={false} animate={{ opacity: i === at ? 1 : 0 }} transition={reduced ? INSTANT : FADE}>{t}</motion.span>
          ))}
        </span>
        <motion.span className="pws-bad" aria-hidden="true" initial={false} animate={{ opacity: bad ? 1 : 0 }} transition={reduced ? INSTANT : FADE}>Commonly guessed</motion.span>
      </div>
      {showRules && (
        <ul className="pws-rules">
          {evaluated.map((r) => (
            <li key={r.id} className={r.met ? "met" : undefined}>
              <span className="pws-box" aria-hidden="true">
                <motion.svg viewBox="0 0 12 12" fill="none" initial={false} animate={{ opacity: r.met ? 1 : 0, scale: r.met ? 1 : 0.6 }} transition={reduced ? INSTANT : CELL}>
                  <path d="M2 6.2 4.7 8.9 10 3.3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                </motion.svg>
              </span>
              {r.label}
              <span className="sr-only">{r.met ? " met" : " not met"}</span>
            </li>
          ))}
        </ul>
      )}
      <p aria-live="polite" className="sr-only">{settled}</p>
    </div>
  );
}
