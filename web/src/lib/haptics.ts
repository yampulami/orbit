import { useSyncExternalStore } from "react";

/** A small physical tap for the things you touch: buttons, switches, ticking a chore, sending a message, getting one.
 *  Phones that can vibrate (Android) buzz in short patterns; iPhones have no vibration API, so the same tap is borrowed from the system switch control
 *  (iOS 17.4 and later). Nothing happens on a computer, when the person asked their device for less motion, or when it is switched off in Profile. */
export type Feel = "tap" | "select" | "success" | "warn" | "send" | "receive";

const PATTERNS: Record<Feel, number | number[]> = {
  tap: 8,
  select: 12,
  success: [10, 45, 18],
  warn: [24, 50, 24],
  send: [6, 30, 10],
  receive: [14, 40, 8],
};

const KEY = "orbit-haptics";
const subs = new Set<() => void>();
const read = () => { try { return localStorage.getItem(KEY) !== "0"; } catch { return true; } };
let on = read();

export const hapticsOn = () => on;
export function setHaptics(value: boolean) {
  on = value;
  try { localStorage.setItem(KEY, value ? "1" : "0"); } catch { /* ignore */ }
  subs.forEach((f) => f());
  if (value) haptic("success");
}
export const useHaptics = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => on);

const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const canVibrate = () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
/** Browsers only allow a buzz after the person has touched the page at least once; asking sooner just fills the console with warnings. */
const touched = () => { const ua = (navigator as unknown as { userActivation?: { hasBeenActive: boolean } }).userActivation; return ua ? ua.hasBeenActive : true; };
const isTouchPhone = () => typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

let last = 0;
let ios: HTMLLabelElement | null = null;
/** The iPhone way: a hidden switch that is tapped by code, which makes the system play its own tap. */
function iosTap() {
  if (!ios) {
    ios = document.createElement("label");
    ios.setAttribute("aria-hidden", "true");
    ios.style.cssText = "position:fixed;left:-100px;top:-100px;width:1px;height:1px;opacity:0;pointer-events:none";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.setAttribute("switch", "");
    ios.appendChild(box);
    document.body.appendChild(ios);
  }
  ios.click();
}

/** Give a tap. Safe to call anywhere: it does nothing when it cannot or should not. */
export function haptic(feel: Feel = "tap") {
  if (!on || typeof document === "undefined" || reducedMotion() || !touched()) return;
  const now = Date.now();
  if (now - last < 35) return; // a pile of calls in one moment is one tap
  last = now;
  try {
    if (canVibrate()) navigator.vibrate(PATTERNS[feel]);
    else if (isTouchPhone()) iosTap();
  } catch { /* some browsers refuse; it is only a nicety */ }
}

/** Every button, switch and tick box gives a tap on its own, without each screen asking. */
export function startHaptics() {
  if (typeof document === "undefined") return;
  document.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("button, [role=button], [role=switch], [role=checkbox], [role=radio], [role=tab], a.navlink, a.drawer-link, summary");
    if (!el || (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
    const label = el.getAttribute("aria-label") ?? "";
    if (/^(delete|remove|block|sign out)/i.test(label) || el.matches(".danger, .btn.danger")) haptic("warn");
    else if (el.matches("[role=switch], [role=checkbox], [role=radio], [role=tab]")) haptic("select");
    else if (el.matches(".btn.primary, button[type=submit]")) haptic("success");
    else haptic("tap");
  }, { capture: true, passive: true });
}
