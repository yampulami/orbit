import { useEffect, useRef, useState, type ReactNode } from "react";
import { Actor } from "../lib/omega/actor";

/** Omega on the arrival screen. While the app loads he walks on the spot in the middle of the screen: a walk cycle, side-on, the speed drifting between a
 *  stroll and a scurry, with a floor sliding past under his feet at exactly the speed his feet move. Now and then he stops for a small thing and carries on.
 *
 *  When the app is ready (`leaving`) he says goodbye in one move: he crouches and jumps with a somersault, pulls his legs and tail in so that only the ball
 *  is left, shrinks as he flies up to the logo in the corner of the app, and lands on it. At that moment (`onLanded`) the logo's own round ball appears where he
 *  is, and he fades out: he has turned into it. The page behind starts fading (`onFade`) while he is in the air.
 *
 *  He is drawn on the page itself, not inside the screen, so he is still there when the screen has faded. If he cannot load (or motion is reduced) the
 *  `fallback` is shown instead, and leaving just calls both callbacks at once. */
const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const STOPS = ["hop", "look_around", "wave", "blink", "wiggle", "nod", "shrug", "perk", "smile"];
/** How wide his ball is on the screen at a size of 1 (he is a bit over a third of a unit across, drawn at 366 px a unit, flat scale 0.67). */
const BALL_PX = 85;

/** The ball of the logo, wherever the app shows it (the sidebar on a computer, the top corner on a phone). */
function logoBall() {
  for (const sel of [".side .logo .orb", ".logo-mobile .orb", ".logo .orb"]) {
    const el = document.querySelector<HTMLElement>(sel);
    const r = el?.getBoundingClientRect();
    if (r && el && r.width > 4 && r.bottom > 0) {
      // the colours of that ball, so he can turn into it (white with dark eyes in the sidebar, orange on a phone)
      const cs = getComputedStyle(el);
      const body = cs.getPropertyValue("--body").trim() || getComputedStyle(el.querySelector(".orb-body") ?? el).backgroundColor || "#f4f4f5";
      const eye = cs.getPropertyValue("--eye").trim() || "#09090b";
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, size: r.width, body, eye };
    }
  }
  return null;
}

export default function ArrivalWalker({ leaving, onFade, onLanded, fallback }: { leaving: boolean; onFade: () => void; onLanded: () => void; fallback?: ReactNode }) {
  const slot = useRef<HTMLDivElement>(null);
  const floor = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(reduced);
  const goodbye = useRef<(() => void) | null>(null);
  const wantsToLeave = useRef(false);
  const callbacks = useRef({ onFade, onLanded });
  callbacks.current = { onFade, onLanded };

  useEffect(() => {
    const el = slot.current;
    if (!el || failed) return;
    const actor = new Actor({ parent: document.body, baseUrl: "/omega/", scale: 1.15, flat: true, dark: document.documentElement.dataset.theme === "dark" });
    let gone = false, ending = false, flying = false, raf = 0, offset = 0, last = performance.now(), v = 0.25, target = 0.3;
    let flightDone: Promise<void> = Promise.resolve();
    const feet = () => el.getBoundingClientRect().bottom - 14;
    const place = () => { const r = el.getBoundingClientRect(); actor.lockY = feet(); actor.setBand(Math.ceil(feet() + 80)); actor.pos.x = r.left + r.width / 2; actor.pos.y = feet(); };
    const onResize = () => { if (!ending) place(); };
    window.addEventListener("resize", onResize);

    // the floor slides left at the speed of his feet
    const tick = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05); last = t;
      if (!ending) {
        v += (target - v) * Math.min(1, dt * 1.6);
        actor.treadmill(v);
        offset += actor.groundSpeed() * dt;
        if (floor.current) floor.current.style.backgroundPositionX = `${-offset}px`;
      }
      raf = requestAnimationFrame(tick);
    };

    // the goodbye: jump, somersault, tuck into a ball, fly to the logo, land
    const farewell = () => {
      if (ending || gone) return;
      ending = true; flying = true;
      const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
      flightDone = (async () => {
        const logo = logoBall();
        const c0 = actor.ballCenter();
        if (!logo || !c0) { callbacks.current.onFade(); callbacks.current.onLanded(); return; }
        const u0 = actor.userScale, uF = logo.size / BALL_PX;
        const offY = (c0.y - actor.pos.y) * (uF / u0); // how far above his feet the middle of the ball is, at the size it will land at
        actor.treadmill(null);
        actor.lockY = null;
        actor.scaleGoal = uF;
        window.setTimeout(() => actor.retract(true), 560); // in the air, legs and tail go in
        // and he changes colour on the way up, into the colour of the logo's ball
        const t1 = performance.now() + 450;
        const tint = () => { const p = Math.min(1, Math.max(0, (performance.now() - t1) / 650)); actor.setTint(logo.body, logo.eye, p * p * (3 - 2 * p)); if (p < 1 && !gone) requestAnimationFrame(tint); };
        window.setTimeout(() => requestAnimationFrame(tint), 450);
        window.setTimeout(() => actor.setShadow(false), 700);
        window.setTimeout(() => callbacks.current.onFade(), 900); // the screen starts to fade while he is up
        await actor.play("flip", { face: Math.PI / 2, glide: { to: { x: logo.cx, y: logo.cy - offY }, arc: 110, from: 0.2, until: 0.74 } });
        // he has landed on the logo: its ball appears, he fades into it
        callbacks.current.onLanded();
        actor.setOpacity(0, 280);
        await wait(340);
      })();
    };
    goodbye.current = farewell;

    void actor.loadNow().then(async () => {
      if (gone) return;
      if (!actor.has("walk")) { setFailed(true); return; }
      place();
      actor.setHeading(Math.PI / 2); // side-on, walking to the right
      raf = requestAnimationFrame(tick);
      if (wantsToLeave.current) { farewell(); return; }
      let lastStop = "";
      while (!gone && !ending) {
        // a pace, held for a few seconds, then another: a stroll, a brisk walk, a scurry
        target = [0.22, 0.3, 0.38, 0.5, 0.62][Math.floor(Math.random() * 5)];
        await new Promise((r) => window.setTimeout(r, rnd(1800, 3600)));
        if (gone || ending) return;
        if (Math.random() < 0.45) {
          const options = STOPS.filter((n) => actor.has(n) && n !== lastStop);
          lastStop = options[Math.floor(Math.random() * options.length)];
          await actor.play(lastStop, { face: Math.PI / 2 });
        }
      }
    }).catch(() => setFailed(true));

    return () => {
      gone = true; goodbye.current = null; cancelAnimationFrame(raf); window.removeEventListener("resize", onResize);
      // if he is in the middle of the flight when the screen goes, let him land before he is taken down
      if (flying) void flightDone.then(() => actor.destroy()); else actor.destroy();
    };
  }, [failed]);

  // the app is ready: time to go
  useEffect(() => {
    if (!leaving) return;
    wantsToLeave.current = true;
    if (failed) { onFade(); onLanded(); return; }
    goodbye.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving, failed]);

  if (failed) return <>{fallback ?? null}</>;
  return (
    <div ref={slot} className="arrival-walk" role="img" aria-label="Omega, Orbit's little robot, walking">
      <div ref={floor} className="arrival-floor" />
    </div>
  );
}
