import { useEffect, useRef, useState } from "react";
import { createLiveOrb, type LiveOrbInstance, type LiveOrbVariant } from "../lib/liveOrb";
import Orb from "./Orb";

/** The large shaded orb. Falls back to the light CSS orb when the device cannot do WebGL, so it is never an empty hole. */
export default function OrbGL({ size = 260, variant = "webgl", colors, className = "" }: { size?: number; variant?: LiveOrbVariant; colors?: string[]; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<LiveOrbInstance | null>(null);
  const [hasGl, setHasGl] = useState(false);

  useEffect(() => {
    if (!canvas.current) return;
    engine.current = createLiveOrb(canvas.current, { variant, colors, onHasGl: setHasGl });
    return () => { engine.current?.destroy(); engine.current = null; };
    // The engine reads live options through setOptions below; mount once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { engine.current?.setOptions({ variant, colors, onHasGl: setHasGl }); }, [variant, colors]);

  return (
    <div className={"orb-gl " + className} aria-hidden="true" style={{ width: size, height: size, position: "relative", flex: "none" }}>
      {!hasGl && <Orb size={size * 0.94} variant="wash" className="orb-gl-fallback" />}
      <canvas ref={canvas} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
    </div>
  );
}
