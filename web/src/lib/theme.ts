import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
export type ThemePref = Theme | "system";
const KEY = "orbit-theme";
const subs = new Set<() => void>();
const media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;

const readPref = (): ThemePref => {
  try { const v = localStorage.getItem(KEY); if (v === "light" || v === "dark") return v; } catch { /* storage unavailable */ }
  return "system";
};
const resolve = (p: ThemePref): Theme => (p === "system" ? (media?.matches ? "dark" : "light") : p);

let pref: ThemePref = readPref();
/** index.html sets data-theme before first paint, from the saved choice or the system setting. */
let now: Theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";

function show(t: Theme) {
  if (t === now && document.documentElement.dataset.theme === t) return;
  const root = document.documentElement;
  const apply = () => { root.dataset.theme = t; };
  type VT = { ready?: Promise<void>; finished?: Promise<void>; updateCallbackDone?: Promise<void> };
  const doc = document as Document & { startViewTransition?: (cb: () => void) => VT };
  now = t;
  if (doc.startViewTransition && !document.hidden) {
    const vt = doc.startViewTransition(apply);
    // A skipped or interrupted transition is fine: the theme still applies. Keep it from logging as an error.
    vt.ready?.catch(() => {}); vt.finished?.catch(() => {}); vt.updateCallbackDone?.catch(() => {});
  } else {
    root.classList.add("theme-fade");
    apply();
    setTimeout(() => root.classList.remove("theme-fade"), 700);
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "dark" ? "#0e0c15" : "#fbf7f3");
}

/** Chooses light, dark, or follow the system. Switching fades slowly so the page never flashes. */
export function setThemePref(p: ThemePref) {
  pref = p;
  try { if (p === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, p); } catch { /* ignore */ }
  show(resolve(p));
  subs.forEach((f) => f());
}

/** The sidebar toggle: always an explicit light or dark choice. */
export const setTheme = (t: Theme) => setThemePref(t);

media?.addEventListener("change", () => {
  if (pref !== "system") return;
  show(resolve("system"));
  subs.forEach((f) => f());
});

const subscribe = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };
export const useTheme = () => useSyncExternalStore(subscribe, () => now);
export const useThemePref = () => useSyncExternalStore(subscribe, () => pref);
