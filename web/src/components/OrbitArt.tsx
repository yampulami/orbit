import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import OrbitSatellite, { useOrbitAngle } from "./OrbitSatellite";
import { hopFor, onOrbit } from "../lib/orbitEvents";
import { Building2, Bus, Home, Sofa, type LucideIcon } from "lucide-react";
import type { Living } from "../lib/profile";

const PASTELS = ["var(--pink)", "var(--peach)", "var(--mint)", "var(--lav)", "var(--butter)", "var(--pink)"];
const INKS = ["var(--pink-ink)", "var(--peach-ink)", "var(--mint-ink)", "var(--lav-ink)", "var(--butter-ink)", "var(--pink-ink)"];
const LIVING_ICON: Record<Living, LucideIcon> = { residence: Building2, commute: Bus, "off-campus": Sofa, other: Home };
const LIVING_FILL: Record<Living, string> = { residence: "var(--peach)", commute: "var(--mint)", "off-campus": "var(--lav)", other: "var(--pink)" };
const C = 200; // center of the 400 x 400 drawing
const spring = { type: "spring" as const, stiffness: 520, damping: 26 };

/** The picture beside the onboarding questions: the campus as a circle with a dot in orbit, and it answers whatever you pick.
 *  The circle squashes and rings ripple outward on every answer. More years on campus add rings, each interest flies in as a planet,
 *  the finale is one calm lap of both bodies and a ring pulse. Decorative only, and calm for people who prefer reduced motion. */
export default function OrbitArt({ step, rings, planets, initial, campus, living, done, kick, late = false }: { step: string; rings: number; planets: number[]; initial: string; campus?: string; living: Living | null; done: boolean; kick: number; late?: boolean }) {
  const reduce = useReducedMotion() ?? false;
  const showRings = Math.max(rings, 1);
  const outer = 70 + showRings * 20;
  const LivingIcon = living ? LIVING_ICON[living] : null;

  // Two small bodies: the orange one on the outer ring, a pale one on the ring inside it that joins on the later questions. Both drift very slowly
  // (faster while a field is in use), hop when you pick something, and take one full lap at the end.
  const IDLE = 5, ENGAGED = 14;
  const main = useOrbitAngle(-40, IDLE, reduce);
  const second = useOrbitAngle(150, -IDLE * 1.4, reduce);
  const [pulse, setPulse] = useState(0);
  useEffect(() => onOrbit((e) => {
    if (e.type === "INPUT_FOCUSED") { main.setSpeed(ENGAGED); second.setSpeed(-ENGAGED * 1.2); }
    else if (e.type === "INPUT_BLURRED") { main.setSpeed(IDLE); second.setSpeed(-IDLE * 1.4); }
    else if (e.type === "SELECTION_MADE" && !e.off) {
      if (e.step === "about") void second.hopBy(hopFor(e.index, e.count) + (e.custom ? 40 : 0));
      else if (e.step === "interests") { if ((e.count ?? 1) <= 1) void main.hopBy(40, 0.7); }
      else { void main.hopBy(hopFor(e.index, e.count)); setPulse((n) => n + 1); }
    }
    else if (e.type === "VALIDATION_SUCCESS") setPulse((n) => n + 1);
    else if (e.type === "STEP_CHANGED" && e.to === "done") { void main.hopBy(360, 2.4); void second.hopBy(-360, 2.4); }
    else if (e.type === "ONBOARDING_COMPLETED") setPulse((n) => n + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  return (
    <svg viewBox="0 0 400 400" className="orbit-art" role="presentation">
      {/* rings: one more for every year on campus, each one springing out when it appears */}
      {Array.from({ length: 6 }, (_, n) => n + 1).map((n) => (
        <motion.circle key={n} cx={C} cy={C} r={70 + n * 20} fill="none" stroke="var(--accent)" strokeWidth={2}
          initial={false} animate={{ opacity: n <= showRings ? (n === showRings ? 0.6 : 0.28) : 0, scale: n <= showRings ? 1 : 0.8 }} style={{ transformOrigin: "200px 200px" }} transition={spring} />
      ))}

      {/* a ripple leaves the campus every time you answer something */}
      <AnimatePresence>
        {!reduce && kick > 0 && (
          <motion.circle key={kick} cx={C} cy={C} fill="none" stroke="var(--accent)" strokeWidth={3}
            initial={{ r: 62, opacity: 0.6 }} animate={{ r: outer + 34, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
        )}
      </AnimatePresence>

      {/* the ring picks up a brief emphasis when something is chosen or confirmed */}
      <AnimatePresence>
        {!reduce && pulse > 0 && <motion.circle key={`pulse-${pulse}`} cx={C} cy={C} r={outer} fill="none" stroke="var(--accent)" strokeWidth={3} initial={{ opacity: 0.7 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: "easeOut" }} />}
      </AnimatePresence>

      <OrbitSatellite angle={second.angle} radius={Math.max(outer - 20, 62 + 18)} size={6} fill="var(--gold)" show={late} />
      <OrbitSatellite angle={main.angle} radius={outer} size={9} fill="var(--accent)" />

      {/* planets: what you are here for. They shoot out of the campus and then drift gently */}
      {planets.map((p, n) => {
        const a = (n / Math.max(planets.length, 1)) * Math.PI * 2 - Math.PI / 2 + 0.4;
        const r = outer + 26;
        const px = C + Math.cos(a) * r, py = C + Math.sin(a) * r;
        return (
          <motion.g key={p} initial={reduce ? { opacity: 0 } : { x: C - px, y: C - py, scale: 0.2, opacity: 0 }} animate={{ x: 0, y: reduce ? 0 : [0, -4, 0], scale: 1, opacity: 1 }}
            transition={{ x: spring, scale: spring, opacity: { duration: 0.15 }, y: reduce ? undefined : { repeat: Infinity, duration: 4 + n * 0.4, ease: "easeInOut", delay: 0.5 } }}>
            <circle cx={px} cy={py} r={15} fill={PASTELS[p % PASTELS.length]} stroke={INKS[p % INKS.length]} strokeWidth={2} />
          </motion.g>
        );
      })}

      {/* the campus: squashes and rebounds on every answer, and breathes a little in between */}
      <motion.g key={`campus-${kick}`} style={{ transformOrigin: "200px 200px" }} initial={false}
        animate={reduce ? {} : { scale: kick > 0 ? [1, 1.14, 0.95, 1.03, 1] : [1, 1.02, 1] }}
        transition={reduce ? undefined : kick > 0 ? { duration: 0.55, ease: "easeOut" } : { repeat: Infinity, duration: 5, ease: "easeInOut" }}>
        <circle cx={C} cy={C} r={62} fill="var(--accent)" />
        {step === "campus" && campus ? (
          <g aria-hidden="true">
            {[{ x: -26, w: 16, h: 30 }, { x: -8, w: 18, h: 44 }, { x: 12, w: 16, h: 26 }].map((b, n) => (
              <motion.rect key={`${campus}-${n}`} x={C + b.x} y={C + 22 - b.h} width={b.w} height={b.h} rx={3} fill="#fff" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} style={{ transformOrigin: `${C + b.x}px ${C + 22}px` }} transition={{ ...spring, delay: n * 0.08 }} />
            ))}
            <motion.circle key={`sun-${campus}`} cx={C + 4} cy={C - 30} r={5} fill="var(--gold)" initial={{ scale: 0, y: -14 }} animate={{ scale: 1, y: 0 }} transition={{ ...spring, delay: 0.3 }} style={{ transformOrigin: `${C + 4}px ${C - 30}px` }} />
          </g>
        ) : (
          <motion.text key={initial} x={C} y={C + 14} textAnchor="middle" fontSize={44} fontWeight={500} fill="#fff" fontFamily="var(--display)" initial={reduce ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ transformOrigin: "200px 200px" }} transition={spring}>
            {initial.toUpperCase()}
          </motion.text>
        )}
      </motion.g>

      {/* where you live: a small badge with the matching picture pops in beside the campus */}
      <AnimatePresence>
        {step === "living" && living && LivingIcon && (
          <motion.g key={living} initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={spring} style={{ transformOrigin: `${C + 74}px ${C + 74}px` }}>
            <circle cx={C + 74} cy={C + 74} r={26} fill={LIVING_FILL[living]} stroke="var(--ink)" strokeWidth={2} />
            <LivingIcon x={C + 74 - 13} y={C + 74 - 13} size={26} color="var(--ink)" strokeWidth={2} />
          </motion.g>
        )}
      </AnimatePresence>

    </svg>
  );
}
