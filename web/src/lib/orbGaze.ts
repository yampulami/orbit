/** What Orbit's orbs look at. One shared watcher serves every orb on the page: they follow the pointer, look toward the field you are typing in, and
 *  glance around on their own when nothing is happening. It pauses for orbs that are off screen or in a hidden tab, and holds still under reduced motion. */
export type Look = { x: number; y: number };
export type OrbMood = "idle" | "happy" | "excited" | "sleepy" | "loading";

const REST: Look = { x: 0, y: 0.08 };
/** How long the pointer (or a focused field) keeps the eyes before they start wandering. */
export const IDLE_MS = 3000;
export const FOCUS_MS = 4500;

/** Pure: where to look, as a direction between -1 and 1 on each axis, to face a point from an orb's box. Closer points pull the eyes less far. */
export function lookToward(box: { left: number; top: number; width: number; height: number }, px: number, py: number): Look {
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const dx = px - cx;
  const dy = cy - py; // up is positive
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return { ...REST };
  const reach = Math.min(1, dist / Math.max(box.width * 0.9, 40));
  return { x: (dx / dist) * reach, y: (dy / dist) * reach };
}

/** Pure: how often an orb in this mood blinks and wanders, in milliseconds. */
export function moodTiming(mood: OrbMood): { blink: [number, number]; glance: [number, number]; spread: number } {
  switch (mood) {
    case "sleepy": return { blink: [1800, 3200], glance: [3500, 6000], spread: 0.25 };
    case "loading": return { blink: [2200, 4200], glance: [500, 900], spread: 0.9 };
    case "excited": return { blink: [3000, 5000], glance: [350, 700], spread: 0.9 };
    case "happy": return { blink: [2500, 4500], glance: [900, 1800], spread: 0.5 };
    default: return { blink: [2200, 6000], glance: [900, 3000], spread: 0.8 };
  }
}

type Sub = { el: HTMLElement; mood: () => OrbMood; look: Look; goal: Look; nextGlance: number; nextBlink: number; visible: boolean };
const subs = new Set<Sub>();
let pointer = { x: 0, y: 0, at: -Infinity };
let focus: { el: Element | null; at: number } = { el: null, at: -Infinity };
let raf = 0;
let listening = false;
let reduce: MediaQueryList | null = null;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

const onMove = (e: PointerEvent) => { pointer = { x: e.clientX, y: e.clientY, at: performance.now() }; kick(); };
const onFocus = (e: FocusEvent) => {
  const t = e.target;
  if (t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) { focus = { el: t, at: performance.now() }; kick(); }
};
const onVisible = () => kick();

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  window.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("focusin", onFocus);
  document.addEventListener("visibilitychange", onVisible);
}
function unlisten() {
  if (!listening) return;
  listening = false;
  window.removeEventListener("pointermove", onMove);
  document.removeEventListener("focusin", onFocus);
  document.removeEventListener("visibilitychange", onVisible);
  cancelAnimationFrame(raf); raf = 0;
}

function apply(s: Sub) {
  s.el.style.setProperty("--lx", s.look.x.toFixed(3));
  s.el.style.setProperty("--ly", s.look.y.toFixed(3));
}

function blink(s: Sub) {
  s.el.setAttribute("data-blink", "");
  window.setTimeout(() => s.el.removeAttribute("data-blink"), 200);
}

function frame(now: number) {
  raf = 0;
  const live = [...subs].filter((s) => s.visible);
  if (live.length === 0 || document.visibilityState === "hidden") return;
  const still = reduce?.matches;
  for (const s of live) {
    const mood = s.mood();
    const t = moodTiming(mood);
    const box = s.el.getBoundingClientRect();
    if (still) { s.look = { ...REST }; apply(s); continue; }
    if (now - pointer.at < IDLE_MS) s.goal = lookToward(box, pointer.x, pointer.y);
    else if (focus.el?.isConnected && now - focus.at < FOCUS_MS) {
      const f = focus.el.getBoundingClientRect();
      s.goal = lookToward(box, f.left + Math.min(f.width / 2, 120), f.top + f.height / 2);
    } else if (now >= s.nextGlance) {
      const back = Math.random() < 0.3;
      s.goal = back ? { ...REST } : { x: rnd(-1, 1) * t.spread, y: rnd(-0.6, 0.6) * t.spread };
      s.nextGlance = now + rnd(...t.glance);
    }
    const steering = now - pointer.at < IDLE_MS;
    const ease = steering ? 0.16 : 0.1;
    s.look = { x: s.look.x + (s.goal.x - s.look.x) * ease, y: s.look.y + (s.goal.y - s.look.y) * ease };
    apply(s);
    if (now >= s.nextBlink) { blink(s); s.nextBlink = now + rnd(...t.blink); }
  }
  raf = requestAnimationFrame(frame);
}

function kick() { if (!raf && subs.size > 0) raf = requestAnimationFrame(frame); }

/** Starts watching for one orb. Returns the function that stops. */
export function attachOrb(el: HTMLElement, mood: () => OrbMood): () => void {
  listen();
  const s: Sub = { el, mood, look: { ...REST }, goal: { ...REST }, nextGlance: performance.now() + rnd(600, 1500), nextBlink: performance.now() + rnd(1500, 3500), visible: true };
  subs.add(s);
  apply(s);
  const io = new IntersectionObserver(([entry]) => { s.visible = entry?.isIntersecting ?? true; kick(); });
  io.observe(el);
  kick();
  return () => {
    io.disconnect();
    subs.delete(s);
    if (subs.size === 0) unlisten();
  };
}
