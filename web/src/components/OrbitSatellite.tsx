import { animate, motion, useAnimationFrame, useMotionValue, useTransform, type MotionValue } from "framer-motion";
import { useRef } from "react";

/** The angle of a small body travelling a ring: a slow steady drift that eases between speeds, plus one-off hops that glide forward and settle.
 *  Nothing here renders; it hands back a motion value so the drawing never re-renders on a frame. It stands still when the tab is hidden or motion is reduced. */
export function useOrbitAngle(start: number, baseSpeed: number, reduce: boolean) {
  const drift = useMotionValue(start);
  const hop = useMotionValue(0);
  const speed = useRef(baseSpeed);
  const target = useRef(baseSpeed);
  useAnimationFrame((_, dt) => {
    if (reduce || document.hidden) return;
    speed.current += (target.current - speed.current) * Math.min(1, dt / 500); // ease toward the wanted speed
    drift.set(drift.get() + (speed.current * dt) / 1000);
  });
  const angle = useTransform([drift, hop], ([d, h]: number[]) => d + h);
  return {
    angle,
    /** Degrees per second the body should settle to. */
    setSpeed: (v: number) => { target.current = v; },
    /** Glide forward by this many degrees (instant under reduced motion). */
    hopBy: (deg: number, seconds = 0.9) => animate(hop, hop.get() + deg, reduce ? { duration: 0 } : { duration: seconds, ease: [0.65, 0, 0.35, 1] }),
  };
}

/** One small body on a ring, centred on (200, 200) in the 400 x 400 drawing. */
export default function OrbitSatellite({ angle, radius, size, fill, show = true }: { angle: MotionValue<number>; radius: number; size: number; fill: string; show?: boolean }) {
  return (
    <motion.g style={{ rotate: angle, transformOrigin: "200px 200px" }} initial={false} animate={{ opacity: show ? 1 : 0 }} transition={{ duration: 0.4 }}>
      <motion.circle cx={200} cy={200 - radius} r={size} fill={fill} initial={false} animate={{ cy: 200 - radius }} transition={{ type: "spring", stiffness: 300, damping: 26 }} />
    </motion.g>
  );
}
