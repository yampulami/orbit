import { useSyncExternalStore } from "react";
import { announceActive, getActiveIds, subscribeActive } from "./nudge";

/** The green orb beside a name: that person has Orbit open right now. It is a setting (on by default); turning it off also hides everyone else's,
 *  so nobody is watched without being watchable. */
const KEY = "orbit-show-active";
const EMPTY = new Set<string>();
const subs = new Set<() => void>();
let enabled = (() => { try { return localStorage.getItem(KEY) !== "0"; } catch { return true; } })();
let last: { me: string | null; rooms: string[] } = { me: null, rooms: [] };

export const showActive = () => enabled;
export function setShowActive(on: boolean) {
  enabled = on;
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* it still applies for now */ }
  announceActive(enabled ? last.me : null, last.rooms);
  subs.forEach((f) => f());
}
/** Called when the list of conversations is known (or empty when signing out). */
export function syncActive(me: string | null, rooms: string[]) {
  last = { me, rooms };
  announceActive(enabled ? me : null, rooms);
}

/** Who has Orbit open right now, among the people you talk with. Empty when you have turned this off. */
export function useActiveUsers(): Set<string> {
  const on = useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => enabled);
  const ids = useSyncExternalStore(subscribeActive, getActiveIds);
  return on ? ids : EMPTY;
}
export const useShowActive = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => enabled);
