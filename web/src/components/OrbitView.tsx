import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Users } from "lucide-react";
import { useHang } from "../lib/hangouts";
import { useMoments } from "../lib/useMoments";
import { headline, whenLabel } from "../lib/moments";

const TONES = ["#a96bff", "#6f9cff", "#ff8a5c", "#6fe0a0", "#ef5fcf"];

/** Your groups circling you. Each one turns slowly; point at or tap one to stop it and see who in it shares their free time and the next time you could meet. */
export default function OrbitView() {
  const { groups } = useHang();
  const { circles, moments } = useMoments(20);
  const [angle, setAngle] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [size, setSize] = useState(320);
  const box = useRef<HTMLDivElement>(null);
  const nodes = useMemo(() => groups.slice(0, 8), [groups]);

  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setSize(Math.max(260, Math.min(420, e.contentRect.width))));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (open || nodes.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, last = performance.now();
    const tick = (t: number) => { setAngle((a) => (a + (t - last) * 0.006) % 360); last = t; raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, nodes.length]);

  if (nodes.length === 0) return null;
  const r = size / 2 - 44;
  const sel = nodes.find((g) => g.id === open);
  const circle = circles.find((c) => c.id === open);
  const next = moments.find((m) => m.circleId === open);

  return (
    <section className="orbitview" aria-label="Your orbit">
      <div className="ov-stage" ref={box} style={{ height: size }} onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
        <span className="ov-ring" style={{ width: r * 2, height: r * 2 }} aria-hidden="true" />
        <span className="ov-core" aria-hidden="true"><i /><i /></span>
        {nodes.map((g, i) => {
          const a = ((i / nodes.length) * 360 + angle) * Math.PI / 180;
          const c = circles.find((x) => x.id === g.id);
          const energy = c && c.total > 1 ? Math.round((c.members.length / (c.total - 1)) * 100) : 0;
          const live = moments.some((m) => m.circleId === g.id && m.start.getTime() <= Date.now());
          return (
            <button key={g.id} type="button" className="ov-node" data-on={open === g.id ? "" : undefined} data-live={live ? "" : undefined} aria-pressed={open === g.id}
              style={{ transform: `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r}px)`, ["--t" as string]: TONES[i % TONES.length], ["--e" as string]: `${energy}%` }}
              onClick={() => setOpen(open === g.id ? null : g.id)}>
              <span className="ov-dot"><Users size={15} aria-hidden="true" /></span>
              <span className="ov-name">{g.name}</span>
            </button>
          );
        })}
      </div>
      {sel && (
        <div className="ov-card" role="region" aria-label={sel.name}>
          <b>{sel.name}</b>
          <p className="muted">{circle ? `${circle.members.length} of ${Math.max(0, circle.total - 1)} others share their free time with you.` : "Turn on Orbit Moments to see who shares their free time."}</p>
          {next && <p><b>{headline(next)}</b> · {whenLabel(next)}</p>}
          <Link to="/app/chats?tab=groups" className="pill-btn">Open group <ArrowRight size={13} aria-hidden="true" /></Link>
        </div>
      )}
    </section>
  );
}
