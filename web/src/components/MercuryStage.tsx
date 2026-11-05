import { useEffect, useMemo, useRef } from "react";

/** The liquid-metal backdrop: soft blobs of violet that drift, merge through a goo filter, and lean a little towards the pointer. */
export default function MercuryStage() {
  const blobs = useMemo(() => Array.from({ length: 6 }).map(() => ({
    size: Math.random() * 200 + 150, left: Math.random() * 80 + 10, top: Math.random() * 80 + 10,
    delay: Math.random() * -20, duration: Math.random() * 15 + 15,
  })), []);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const move = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth, y = e.clientY / window.innerHeight;
      refs.current.forEach((b, i) => { if (b) { const k = (i + 1) * 20; b.style.marginLeft = `${x * k}px`; b.style.marginTop = `${y * k}px`; } });
    };
    document.addEventListener("mousemove", move);
    return () => document.removeEventListener("mousemove", move);
  }, []);
  return (
    <>
      <svg className="merc-defs" aria-hidden="true" focusable="false">
        <defs>
          <filter id="merc-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>
      <div className="merc-stage" aria-hidden="true">
        {blobs.map((b, i) => (
          <div key={i} ref={(el) => { refs.current[i] = el; }} className="merc-blob" style={{ width: b.size, height: b.size, left: `${b.left}%`, top: `${b.top}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.duration}s` }} />
        ))}
      </div>
    </>
  );
}
