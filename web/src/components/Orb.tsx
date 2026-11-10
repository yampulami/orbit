import { useEffect, useRef, useState } from "react";
import { attachOrb, type OrbMood } from "../lib/orbGaze";

export type OrbVariant = "violet" | "light" | "auto" | "wash" | "green";

/** Orbit's little round character. Its eyes follow the pointer, look toward the field you are typing in, glance around when nothing is happening, and blink.
 *  `mood` changes how it behaves (happy hops, excited bounces, sleepy droops, loading floats and looks about). Tap it and it giggles.
 *  `react` plays a single reaction on top of the mood (see OrbitMascot). */
export default function Orb({ size, variant = "violet", mood = "idle", className = "", poke = true, onPoke, react = null, reactKey = 0 }: { size?: number; variant?: OrbVariant; mood?: OrbMood; className?: string; poke?: boolean; onPoke?: () => void; react?: string | null; reactKey?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [giggle, setGiggle] = useState(0);
  const shown: OrbMood = giggle ? "happy" : mood;
  const moodRef = useRef<OrbMood>(shown);
  moodRef.current = shown;

  useEffect(() => (ref.current ? attachOrb(ref.current, () => moodRef.current) : undefined), []);
  // A one-off reaction (a squash, a hop). The attribute is taken off and put back so the same reaction can play twice in a row.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.removeAttribute("data-react");
    if (!react) return;
    void el.offsetWidth;
    el.setAttribute("data-react", react);
  }, [react, reactKey]);
  useEffect(() => {
    if (!giggle) return;
    const t = window.setTimeout(() => setGiggle(0), 1100);
    return () => window.clearTimeout(t);
  }, [giggle]);

  return (
    <span ref={ref} className={"orb " + className} data-variant={variant} data-mood={shown} aria-hidden="true" style={size ? { width: size, height: size } : undefined}
      onPointerDown={poke ? () => { setGiggle((n) => n + 1); onPoke?.(); } : undefined}>
      <span className="orb-body"><span className="orb-eye l" /><span className="orb-eye r" /></span>
    </span>
  );
}
