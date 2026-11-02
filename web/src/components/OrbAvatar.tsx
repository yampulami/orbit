import { useId } from "react";
import { motion } from "framer-motion";
import type { OrbMood } from "../lib/orbGaze";

/** The Orbit face: a soft orange orb with a little grain, a glossy highlight and eyes that blink now and then.
 *  Built from the "AI Avatar" component, with the colour changed from blue to the brand orange. A sleepy mood closes the eyes halfway, an excited one blinks quicker. */
const BLINK = `
@keyframes av-blink {
  0%, 88%, 100% { transform: scaleY(1); }
  93%, 97% { transform: scaleY(0.07); }
}
@media (prefers-reduced-motion: reduce) { .av-eye { animation: none !important; } }
`;
const ORANGE = {
  gradient: "radial-gradient(circle at 50% 45%, #a63e10 0%, #e27a2a 40%, #ffb46a 68%, #ffe8cc 100%)",
  shadow: "0 0 3px 0 rgba(232,100,0,.35), inset 0 0 0 1px rgba(255,255,255,.06)",
  iris: "linear-gradient(135deg, #ffffff 0%, #ffd9b8 100%)",
  shine: "radial-gradient(ellipse at 30% 24%, rgba(255,255,255,.75) 0%, rgba(255,255,255,.1) 50%, transparent 70%)",
};

export default function OrbAvatar({ size = 32, mood = "idle", onPoke, label = "Orbit", decorative = false }: { size?: number; mood?: OrbMood; onPoke?: () => void; label?: string; decorative?: boolean }) {
  const uid = useId().replace(/\W/g, "");
  const eyeW = Math.max(3, Math.round(size * 0.12));
  const eyeH = Math.max(5, Math.round(size * 0.2));
  const gap = Math.max(4, Math.round(size * 0.2));
  const quick = mood === "excited" ? "2.2s" : "3.6s";
  const sleepy = mood === "sleepy";
  return (
    <>
      <style>{BLINK}</style>
      <motion.span
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : label}
        aria-hidden={decorative ? true : undefined}
        onClick={onPoke}
        whileTap={{ scaleX: 1.15, scaleY: 1.3 }}
        transition={{ type: "tween", duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
        style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", width: size, height: size, borderRadius: "50%", overflow: "hidden", cursor: "pointer", background: ORANGE.gradient, boxShadow: ORANGE.shadow }}
      >
        {[{ id: `n${uid}`, f: 0.72, o: 4 }, { id: `g${uid}`, f: 3.2, o: 1 }].map((n) => (
          <svg key={n.id} aria-hidden="true" width="100%" height="100%" style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.2, mixBlendMode: "overlay" }}>
            <defs>
              <filter id={n.id} x="0%" y="0%" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency={n.f} numOctaves={n.o} stitchTiles="stitch" />
                <feColorMatrix type="saturate" values="0" />
              </filter>
            </defs>
            <rect width="100%" height="100%" filter={`url(#${n.id})`} />
          </svg>
        ))}
        <span aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", background: ORANGE.shine }} />
        <span aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at 62% 68%, rgba(0,0,0,0.18) 0%, transparent 55%)" }} />
        <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap, transform: `translateY(${-Math.round(size * 0.04)}px)` }}>
          {[0, 60].map((delay) => (
            <span key={delay} className="av-eye" style={{ display: "block", width: eyeW, height: eyeH, borderRadius: "50%", background: ORANGE.iris, transformOrigin: "center", transform: sleepy ? "scaleY(.45)" : undefined, animation: sleepy ? undefined : `av-blink ${quick} ease-in-out ${delay}ms infinite` }} />
          ))}
        </span>
      </motion.span>
    </>
  );
}
