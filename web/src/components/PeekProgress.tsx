import { useEffect, useRef, useState } from "react";
import { Actor } from "../lib/omega/actor";
import { useTheme } from "../lib/theme";

/** The progress bar of a step-by-step flow, with Omega in it like a whack-a-mole: the segment you are on has his head and eyes poking up over it. Press next and he
 *  ducks down, pops up out of the next segment and looks about. Only his head shows (no legs, no tail) and he holds still: he just pops up and down. With reduced motion, or if he cannot load, it is
 *  the plain bar. */
const BOX_W = 80, BOX_H = 44;
const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const DOWN = BOX_H + 110; // where his feet are when he is out of sight
const UP = BOX_H + 6;    // and when his head and eyes are above the bar (the lower part of the ball stays behind it)

export default function PeekProgress({ count, index, label }: { count: number; index: number; label: string }) {
  const bar = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const seg = useRef<(HTMLElement | null)[]>([]);
  const actor = useRef<Actor | null>(null);
  const target = useRef(DOWN);
  const at = useRef(index);
  const theme = useTheme();
  const [off, setOff] = useState(() => reduced());
  const [x, setX] = useState<number | null>(null);

  const centreOf = (n: number) => { const s = seg.current[n]; return s ? s.offsetLeft + s.offsetWidth / 2 : null; };

  // make him
  useEffect(() => {
    const el = box.current;
    if (!el || off) return;
    const a = new Actor({ parent: el, baseUrl: "/omega/", scale: 0.5, dark: document.documentElement.dataset.theme === "dark", flat: true, inline: true });
    let gone = false, tween = 0;
    const glide = () => { a.pos.y += (target.current - a.pos.y) * 0.2; tween = requestAnimationFrame(glide); };
    void a.loadNow().then(() => {
      if (gone) return;
      if (!a.has("idle")) { setOff(true); return; }
      actor.current = a;
      a.pos.x = BOX_W / 2; a.pos.y = DOWN; a.setHeading(0); a.retract(true); a.setShadow(false); // facing you, head only: no legs, no tail, no shadow
      tween = requestAnimationFrame(glide);
      const c = centreOf(at.current); if (c !== null) setX(c);
      window.setTimeout(() => { target.current = UP; }, 250); // the first pop up
    }).catch(() => setOff(true));
    return () => { gone = true; cancelAnimationFrame(tween); a.destroy(); actor.current = null; };
  }, [off]);

  // a new step: duck, move under the next segment, pop up there
  useEffect(() => {
    if (index === at.current) return;
    at.current = index;
    if (!actor.current) { const c = centreOf(index); if (c !== null) setX(c); return; }
    target.current = DOWN;
    const t1 = window.setTimeout(() => { const c = centreOf(index); if (c !== null) setX(c); }, 260);
    const t2 = window.setTimeout(() => { target.current = UP; }, 320);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [index]);

  // keep him under the right segment when the window changes size
  useEffect(() => {
    const on = () => { const c = centreOf(at.current); if (c !== null) setX(c); };
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [count]);

  useEffect(() => { actor.current?.setDark(theme === "dark"); }, [theme]);

  return (
    <div className="cv-progress cv-peeking" ref={bar} role="progressbar" aria-label={label} aria-valuemin={1} aria-valuemax={count} aria-valuenow={index + 1}>
      {Array.from({ length: count }, (_, n) => <i key={n} ref={(e) => { seg.current[n] = e; }} className={n < index ? "done" : n === index ? "now" : ""} />)}
      {!off && <div className="cv-peek" ref={box} aria-hidden="true" style={{ width: BOX_W, height: BOX_H, left: x === null ? -999 : x - BOX_W / 2 }} />}
    </div>
  );
}
