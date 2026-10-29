import { useSyncExternalStore } from "react";
import { EMPTY_PREFS, type Interest, type Moment, type MomentPrefs } from "./moments";

/** What the student chose about Orbit Moments and what they have said about suggestions. Kept on this device, per person: nothing about it is sent anywhere. */
const KEY = "orbit-moments-v1:";
let owner: string | null = null;
let state: MomentPrefs = EMPTY_PREFS;
const subs = new Set<() => void>();

function set(next: MomentPrefs) {
  state = next;
  if (owner) { try { localStorage.setItem(KEY + owner, JSON.stringify(state)); } catch { /* storage unavailable: it just will not be remembered */ } }
  subs.forEach((f) => f());
}

export function bindMomentPrefs(userId: string) {
  if (owner === userId) return;
  owner = userId;
  try { const s = localStorage.getItem(KEY + userId); state = s ? { ...EMPTY_PREFS, ...(JSON.parse(s) as Partial<MomentPrefs>) } : EMPTY_PREFS; } catch { state = EMPTY_PREFS; }
  subs.forEach((f) => f());
}
export function unbindMomentPrefs() { owner = null; state = EMPTY_PREFS; subs.forEach((f) => f()); }
export const useMomentPrefs = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);

const without = <T,>(list: T[], x: T) => list.filter((y) => y !== x);

export const momentActions = {
  setEnabled(enabled: boolean) { set({ ...state, enabled }); },
  toggleInterest(i: Interest) { set({ ...state, interests: state.interests.includes(i) ? without(state.interests, i) : [...state.interests, i] }); },
  /** "Interested": a small nudge toward this kind of thing. */
  interested(m: Moment) { set({ ...state, liked: { ...state.liked, [m.category]: (state.liked[m.category] ?? 0) + 1 } }); },
  /** "Not interested" and "Prefer another time": this one does not come back. */
  dismiss(m: Moment) { set({ ...state, dismissed: [...state.dismissed.slice(-199), m.id] }); },
  /** "Do not suggest this type". */
  muteType(i: Interest) { set({ ...state, muted: state.muted.includes(i) ? state.muted : [...state.muted, i] }); },
  /** "Hide suggestions involving this circle". */
  hideCircle(id: string) { set({ ...state, hiddenCircles: state.hiddenCircles.includes(id) ? state.hiddenCircles : [...state.hiddenCircles, id] }); },
  /** Bring back everything that was hidden or muted. */
  resetHidden() { set({ ...state, muted: [], hiddenCircles: [], dismissed: [] }); },
  unmute(i: Interest) { set({ ...state, muted: without(state.muted, i) }); },
  showCircle(id: string) { set({ ...state, hiddenCircles: without(state.hiddenCircles, id) }); },
};
