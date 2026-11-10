import { useEffect, useRef, useState } from "react";
import Orb from "./Orb";
import { MASCOT_REST, REACTION_MS, mascotNext, onOrbit, type MascotState } from "../lib/orbitEvents";
import { glanceAt } from "../lib/orbGaze";

/** Orbit's character during setup. It is the same orb as everywhere else (eyes that follow, blink and wander), now answering what the person does:
 *  it leans toward a field you focus, goes calm while you type, squashes and hops when you pick something, moves toward the picture at the end.
 *  It only listens to events (lib/orbitEvents); it never reads the form. Under reduced motion the hops and floating are off and the eyes
 *  still squint a little on a pick, so the feedback is not lost. */
export default function OrbitMascot({ size = 64 }: { size?: number }) {
  const [st, setSt] = useState<MascotState>(MASCOT_REST);
  const [shown, setShown] = useState<MascotState["react"]>(null);
  const box = useRef<HTMLSpanElement>(null);
  const calmTimer = useRef(0);
  const reactTimer = useRef(0);

  useEffect(() => {
    const off = onOrbit((e) => {
      if (e.type === "INPUT_FOCUSED" && e.el && box.current) {
        // Lean a few degrees toward the field you just focused.
        const me = box.current.getBoundingClientRect(), f = e.el.getBoundingClientRect();
        const dx = (f.left + f.width / 2) - (me.left + me.width / 2);
        box.current.style.setProperty("--tilt", `${Math.max(-1, Math.min(1, dx / 300)) * 7}deg`);
      }
      if (e.type === "INPUT_BLURRED" || e.type === "STEP_CHANGED") box.current?.style.setProperty("--tilt", "0deg");
      if (e.type === "SELECTION_MADE" && e.el && !e.off) glanceAt(e.el);
      if (e.type === "TYPING_STARTED") {
        // Calm for as long as typing goes on, and a moment after it stops.
        window.clearTimeout(calmTimer.current);
        calmTimer.current = window.setTimeout(() => setSt((s) => ({ ...s, calm: false })), 2600);
      }
      setSt((s) => mascotNext(s, e));
    });
    return () => { off(); window.clearTimeout(calmTimer.current); window.clearTimeout(reactTimer.current); };
  }, []);

  // A reaction plays, then clears, so the character settles back to idle by itself. A newer reaction replaces an older one.
  useEffect(() => {
    if (!st.react) return;
    setShown(st.react);
    window.clearTimeout(reactTimer.current);
    reactTimer.current = window.setTimeout(() => setShown(null), REACTION_MS[st.react]);
  }, [st.react, st.seq]);

  return (
    <span ref={box} className="mascot" style={{ width: size, height: size }}>
      <Orb size={size} variant="violet" mood={st.calm ? "calm" : "idle"} react={shown} reactKey={st.seq} />
    </span>
  );
}
