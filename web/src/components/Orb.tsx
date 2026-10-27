import { useEffect, useRef, useState } from "react";
import { attachOrb, type OrbMood } from "../lib/orbGaze";

export type OrbVariant = "violet" | "light" | "auto" | "wash";

/** Orbit's little round character. Its eyes follow the pointer, look toward the field you are typing in, glance around when nothing is happening, and blink.
 *  `mood` changes how it behaves (happy hops, excited bounces, sleepy droops, loading floats and looks about). Tap it and it giggles. */
export default function Orb({ size, variant = "violet", mood = "idle", className = "", poke = true }: { size?: number; variant?: OrbVariant; mood?: OrbMood; className?: string; poke?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [giggle, setGiggle] = useState(0);
  const shown: OrbMood = giggle ? "happy" : mood;
  const moodRef = useRef<OrbMood>(shown);
  moodRef.current = shown;

  useEffect(() => (ref.current ? attachOrb(ref.current, () => moodRef.current) : undefined), []);
  useEffect(() => {
    if (!giggle) return;
    const t = window.setTimeout(() => setGiggle(0), 1100);
    return () => window.clearTimeout(t);
  }, [giggle]);

  return (
    <span ref={ref} className={"orb " + className} data-variant={variant} data-mood={shown} aria-hidden="true" style={size ? { width: size, height: size } : undefined}
      onPointerDown={poke ? () => setGiggle((n) => n + 1) : undefined}>
      <span className="orb-body"><span className="orb-eye l" /><span className="orb-eye r" /></span>
    </span>
  );
}
