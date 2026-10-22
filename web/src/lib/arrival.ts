import { useSyncExternalStore } from "react";

/** The screen that covers the page between finishing onboarding and the app being ready. Onboarding starts it; the app says when it is ready;
 *  the screen itself decides when to fade away (never before a short minimum, so it does not flash). */
type State = { active: boolean; shellReady: boolean };
let state: State = { active: false, shellReady: false };
const subs = new Set<() => void>();
const set = (next: State) => { state = next; subs.forEach((f) => f()); };

export const arrival = {
  start() { set({ active: true, shellReady: false }); },
  /** The app behind the screen has mounted. */
  shellReady() { if (state.active && !state.shellReady) set({ ...state, shellReady: true }); },
  end() { if (state.active) set({ active: false, shellReady: false }); },
};

export const useArrival = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
