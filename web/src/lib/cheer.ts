import { useSyncExternalStore } from "react";

/** A short celebration from the orb: it pops up at the bottom of the screen with a line, then leaves. Used when you say you are going to something. */
export type Cheer = { id: number; text: string };
let state: Cheer | null = null;
let next = 1;
let timer = 0;
const subs = new Set<() => void>();
const set = (c: Cheer | null) => { state = c; subs.forEach((f) => f()); };

export const cheer = {
  show(text: string, ms = 1900) {
    window.clearTimeout(timer);
    set({ id: next++, text });
    timer = window.setTimeout(() => set(null), ms);
  },
  hide() { window.clearTimeout(timer); set(null); },
};

export const useCheer = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);

/** Pure: is it late enough that the orb should be drowsy? (11 PM until 5 AM) */
export const isNight = (d: Date) => d.getHours() >= 23 || d.getHours() < 5;

const LINES = ["See you there!", "You are going!", "Nice, it is on your plans.", "Count you in!"];
/** A line for the moment, different each time. */
export const goingLine = (n: number) => LINES[Math.abs(n) % LINES.length];
