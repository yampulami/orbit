import { useEffect, useRef } from "react";

/** The assistant's ball of dots: a sphere of points that turns and breathes. It spins faster and glows green while the assistant is thinking, and rests slowly otherwise. */
const COUNT = 170;
const POINTS = Array.from({ length: COUNT }, (_, i) => {
  // Fibonacci sphere: evenly spread points.
  const y = 1 - (i / (COUNT - 1)) * 2, r = Math.sqrt(1 - y * y), a = i * Math.PI * (3 - Math.sqrt(5));
  return { x: Math.cos(a) * r, y, z: Math.sin(a) * r, seed: (i * 7919) % 1000 / 1000 };
});

export default function DotOrb({ size = 44, thinking = false }: { size?: number; thinking?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef(thinking);
  live.current = thinking;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = canvas.height = Math.round(size * dpr);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, t = 0, last = performance.now(), mood = 0, spin = 0;

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      mood += ((live.current ? 1 : 0) - mood) * Math.min(1, dt * 4);
      spin += dt * (0.5 + mood * 2.2);
      t += dt;
      const light = document.documentElement.dataset.theme !== "dark";
      const base = light ? [70, 40, 170] : [235, 235, 235], glow = light ? [16, 150, 105] : [52, 211, 153];
      const rgb = base.map((c, i) => Math.round(c + (glow[i] - c) * mood));
      const R = size / 2 * (0.78 + Math.sin(t * (2 + mood * 3)) * 0.04 * (0.4 + mood));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const cs = Math.cos(spin), sn = Math.sin(spin), tilt = 0.35, ct = Math.cos(tilt), st = Math.sin(tilt);
      for (const p of POINTS) {
        const x1 = p.x * cs + p.z * sn, z1 = -p.x * sn + p.z * cs;
        const y2 = p.y * ct - z1 * st, z2 = p.y * st + z1 * ct;
        const depth = (z2 + 1) / 2; // 0 far, 1 near
        const wave = mood * Math.max(0, Math.sin(t * 5 - p.y * 4 + p.seed * 6)) * 0.5;
        const a = 0.15 + depth * 0.75 + wave * 0.3;
        ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.min(1, a).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(size / 2 + x1 * R, size / 2 + y2 * R, Math.max(0.5, size * (0.012 + depth * 0.014 + wave * 0.01)), 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return <canvas ref={ref} className="dot-orb" style={{ width: size, height: size }} aria-hidden="true" />;
}
