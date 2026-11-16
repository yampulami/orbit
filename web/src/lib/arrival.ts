import { useSyncExternalStore } from "react";

/** The screen that covers the page between finishing onboarding and the app being ready. Onboarding starts it; the app says when it is ready;
 *  the screen itself decides when to fade away (never before a short minimum, so it does not flash). At the very end Omega rolls up into the logo:
 *  `landed` says when he has arrived, which is when the logo's own ball appears in his place. */
type State = { active: boolean; shellReady: boolean; landed: boolean };
let state: State = { active: false, shellReady: false, landed: false };
const subs = new Set<() => void>();
const set = (next: State) => { state = next; subs.forEach((f) => f()); };

export const arrival = {
  start() { set({ active: true, shellReady: false, landed: false }); },
  /** The app behind the screen has mounted. */
  shellReady() { if (state.active && !state.shellReady) set({ ...state, shellReady: true }); },
  /** Omega has landed on the logo. */
  landed() { if (state.active && !state.landed) set({ ...state, landed: true }); },
  end() { if (state.active) set({ active: false, shellReady: false, landed: false }); },
};

export const useArrival = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
