import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Actor } from "../lib/omega/actor";
import { useTheme } from "../lib/theme";

/** A small live Omega in a box of his own, for places that used to have a still picture: empty states, the logo. He is the same model as in setup, drawn in a
 *  canvas the size of the box. Two ways to be:
 *    "stand": he stands in the box doing small things at random (blinking, looking about, a hop), his eyes follow your cursor, and a tap makes him react;
 *    "peek":  the box is a ledge: he ducks out of sight and now and then rises to look over it. A tap on the thing next to him (`omega:poke` on window) makes
 *             him pop up and jump.
 *  Only a few can be alive at once (the browser limits how many graphics contexts a page can hold), and with reduced motion, or if the model cannot load, the
 *  `fallback` is shown instead. */
const MAX_LIVE = 3;
let live = 0;
const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
type Weighted = [string, number][];
const STAND: Weighted = [["blink", 4], ["look_around", 1.6], ["nod", 1], ["smile", 1.6], ["hop", 1.4], ["wiggle", 1], ["wave", 1], ["shrug", 0.6], ["yawn", 0.7], ["perk", 1], ["tap", 0.6], ["spin", 0.4], ["flip", 0.3], ["bow", 0.5]];
const TAPPED: Weighted = [["shake", 3], ["hop", 3], ["flip", 1.4], ["startle", 2], ["spin", 1.4], ["wiggle", 1.4], ["perk", 1], ["dizzy", 0.6], ["smile", 1]];
const PEEKS: Weighted = [["look_around", 3], ["blink", 3], ["smile", 1.4], ["peek_l", 1.2], ["peek_r", 1.2], ["nod", 1]];
const pick = (list: Weighted, avoid = ""): string => {
  const l = list.filter(([n]) => n !== avoid);
  let r = Math.random() * l.reduce((s, [, w]) => s + w, 0);
  for (const [n, w] of l) if ((r -= w) <= 0) return n;
  return l[0][0];
};

export default function OmegaMini({ width = 96, height = 84, scale = 0.46, mode = "stand", fallback, className, label }: {
  width?: number; height?: number; scale?: number; mode?: "stand" | "peek"; fallback?: ReactNode; className?: string; label?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const actorRef = useRef<Actor | null>(null);
  const [failed, setFailed] = useState(() => reducedMotion() || live >= MAX_LIVE);

  useEffect(() => {
    const el = box.current;
    if (!el || failed) return;
    live++;
    const actor = new Actor({ parent: el, baseUrl: "/omega/", scale, dark: document.documentElement.dataset.theme === "dark", flat: true, inline: true });
    let run = 0, gone = false, hidden = false, reacting = false;
    const down = mode === "peek" ? height + 62 : height - 8; // where his feet are when he is ducked down / standing
    const up = mode === "peek" ? height + Math.min(34, height * 0.9) : height - 8;
    let targetY = mode === "peek" ? down : up;
    let tween = 0;
    const glide = () => { actor.pos.y += (targetY - actor.pos.y) * 0.16; tween = requestAnimationFrame(glide); };
    const wait = (ms: number, alive: () => boolean) => new Promise<void>((res) => { const end = performance.now() + ms; const t = () => { if (!alive() || performance.now() >= end) res(); else window.setTimeout(t, 120); }; t(); });

    const behave = async () => {
      const id = ++run;
      const alive = () => id === run && !gone;
      if (mode === "peek") {
        while (alive()) {
          targetY = down;
          await wait(rnd(4500, 11000), alive);
          if (!alive()) return;
          targetY = up;
          await wait(500, alive);
          for (let i = 0; i < 2 && alive(); i++) { await actor.play(pick(PEEKS), { face: 0 }); await wait(rnd(300, 900), alive); }
          await wait(rnd(500, 1400), alive);
        }
        return;
      }
      let last = "";
      await wait(rnd(500, 1200), alive);
      while (alive()) {
        last = pick(STAND, last);
        await actor.play(last, { face: 0 });
        await wait(rnd(1200, 4200), alive);
      }
    };

    // he looks toward the cursor when it is near
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + actor.pos.x, cy = r.top + actor.pos.y - 30;
      const dx = e.clientX - cx, dy = e.clientY - cy;
      if (Math.hypot(dx, dy) > 420) { actor.look = null; return; }
      actor.look = { x: Math.max(-1, Math.min(1, dx / 140)), y: Math.max(-1, Math.min(1, -dy / 90)) };
    };
    const react = async () => {
      if (reacting) return;
      reacting = true;
      run++;
      actor.cancel();
      if (mode === "peek") targetY = up;
      await actor.play(pick(TAPPED), { face: 0 });
      reacting = false;
      if (!gone) void behave();
    };
    const onTap = () => { void react(); };
    const onWake = () => { void react(); };
    const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([e]) => actor.setVisible(!!e?.isIntersecting), { threshold: 0.01 }) : null;
    io?.observe(el);

    void actor.loadNow().then(() => {
      if (gone) return;
      if (!actor.has("idle")) { setFailed(true); return; }
      actorRef.current = actor;
      actor.pos.x = el.clientWidth / 2;
      actor.pos.y = targetY;
      tween = requestAnimationFrame(glide);
      void behave();
    }).catch(() => setFailed(true));

    window.addEventListener("pointermove", onMove, { passive: true });
    if (mode === "peek") window.addEventListener("omega:poke", onWake);
    else el.addEventListener("pointerdown", onTap);
    return () => {
      gone = true; run++; hidden = true; void hidden;
      cancelAnimationFrame(tween); io?.disconnect();
      window.removeEventListener("pointermove", onMove); window.removeEventListener("omega:poke", onWake); el.removeEventListener("pointerdown", onTap);
      actor.destroy(); actorRef.current = null; live--;
    };
  }, [failed, mode, scale, height]);

  useEffect(() => { actorRef.current?.setDark(theme === "dark"); }, [theme]);

  if (failed) return <>{fallback ?? null}</>;
  const style: CSSProperties = { position: "relative", width, height, overflow: mode === "peek" ? "hidden" : "visible", pointerEvents: mode === "peek" ? "none" : "auto", cursor: mode === "peek" ? undefined : "pointer", flex: "none" };
  return <div ref={box} className={className} style={style} role="img" aria-label={label ?? "Omega, Orbit's little robot"} />;
}
