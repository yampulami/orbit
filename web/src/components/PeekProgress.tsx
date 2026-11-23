import { useEffect, useRef, useState } from "react";

/** The progress bar of a step-by-step flow, with Omega in it like a whack-a-mole: the segment you are on has his head and eyes poking up over it. Press next and he
 *  ducks down, pops up out of the next segment. He is a flat drawing (the same shapes and colours as his reference sheet: orange shell, black visor, ice-blue eyes),
 *  not the 3D model: at this size the glossy model turned into a black disc, and a flat head sits properly among the flat bars. Head only, and he holds still. */
/** The head is as wide as the segment it comes out of (never wider, so it cannot hang over the ends), up to this size. */
const MAX_W = 64;
const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function Head({ w }: { w: number }) {
  return (
    <svg viewBox="0 0 64 64" width={w} height={w} aria-hidden="true" focusable="false">
      <defs><clipPath id="omega-shell"><circle cx="32" cy="38" r="30" /></clipPath></defs>
      {/* the shell */}
      <circle cx="32" cy="38" r="30" fill="#F76F1C" />
      <path d="M7 44 A30 30 0 0 0 57 44 A31 31 0 0 1 7 44Z" fill="#D9480A" opacity=".55" />
      {/* the visor and its rim */}
      <g clipPath="url(#omega-shell)">
        <ellipse cx="32" cy="48" rx="25" ry="27" fill="#0C0805" stroke="#3A1711" strokeWidth="1.6" />
      </g>
      {/* the cap on top */}
      <ellipse cx="32" cy="15" rx="12.5" ry="8" fill="#F76F1C" stroke="#C44208" strokeWidth="1.4" />
      {/* the eyes */}
      <g className="omega-eyes">
        <path d="M18.5 33 Q24 32 28.5 37.5" fill="none" stroke="#A1C3E0" strokeWidth="3" strokeLinecap="round" />
        <path d="M45.5 33 Q40 32 35.5 37.5" fill="none" stroke="#A1C3E0" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export default function PeekProgress({ count, index, label }: { count: number; index: number; label: string }) {
  const seg = useRef<(HTMLElement | null)[]>([]);
  const at = useRef(index);
  const calm = useRef(reduced());
  const [x, setX] = useState<number | null>(null);
  const [w, setW] = useState(MAX_W);
  const [up, setUp] = useState(false);
  const [glance, setGlance] = useState(false);

  const centreOf = (n: number) => { const s = seg.current[n]; return s ? s.offsetLeft + s.offsetWidth / 2 : null; };
  const fit = () => { const s = seg.current[at.current]; if (s) setW(Math.max(24, Math.min(MAX_W, Math.floor(s.offsetWidth)))); };

  // the first pop up
  useEffect(() => {
    const c = centreOf(at.current); if (c !== null) setX(c);
    fit();
    const t = window.setTimeout(() => setUp(true), calm.current ? 0 : 280);
    return () => window.clearTimeout(t);
  }, []);

  // a new step: duck, move under the next segment, pop up there
  useEffect(() => {
    if (index === at.current) return;
    at.current = index;
    if (calm.current) { const c = centreOf(index); if (c !== null) setX(c); return; }
    setUp(false);
    const t1 = window.setTimeout(() => { const c = centreOf(index); if (c !== null) setX(c); }, 240);
    const t2 = window.setTimeout(() => setUp(true), 300);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [index]);

  // something was picked below (a colour, an icon): his eyes drop to it for a moment
  useEffect(() => {
    let t = 0;
    const on = () => { setGlance(true); window.clearTimeout(t); t = window.setTimeout(() => setGlance(false), 1100); };
    window.addEventListener("cv:picked", on);
    return () => { window.removeEventListener("cv:picked", on); window.clearTimeout(t); };
  }, []);

  // keep him under the right segment when the window changes size
  useEffect(() => {
    const on = () => { const c = centreOf(at.current); if (c !== null) setX(c); fit(); };
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [count]);

  return (
    <div className="cv-progress cv-peeking" role="progressbar" aria-label={label} aria-valuemin={1} aria-valuemax={count} aria-valuenow={index + 1}>
      {Array.from({ length: count }, (_, n) => <i key={n} ref={(e) => { seg.current[n] = e; }} className={n < index ? "done" : n === index ? "now" : ""} />)}
      <div className="cv-peek" data-up={up ? "" : undefined} data-glance={glance ? "" : undefined} aria-hidden="true" style={{ width: w, height: Math.round(w * 0.625), left: x === null ? -999 : x - w / 2 }}><Head w={w} /></div>
    </div>
  );
}
