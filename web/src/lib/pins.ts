import { useSyncExternalStore } from "react";
import { undo } from "./undo";

/** Things you marked as very important: a few hangouts, reminders or chores, shown first on Home. Saved on this device only. */
export type PinKind = "hangout" | "reminder" | "chore";
export type Pin = { kind: PinKind; id: string };
export const MAX_PINS = 3;

const KEY = "orbit-pins-v1";
const same = (a: Pin, b: Pin) => a.kind === b.kind && a.id === b.id;

function load(): Pin[] {
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s) as Pin[]; } catch { /* storage unavailable */ }
  return [];
}

let state: Pin[] = load();
const subs = new Set<() => void>();
function set(next: Pin[]) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  subs.forEach((f) => f());
}

export const pinActions = {
  has: (p: Pin) => state.some((x) => same(x, p)),
  /** Pins an item, or unpins it if it is already pinned. Returns "full" when there is no room. */
  toggle(p: Pin, title = "item"): "pinned" | "unpinned" | "full" {
    if (state.some((x) => same(x, p))) { pinActions.unpin(p, title); return "unpinned"; }
    if (state.length >= MAX_PINS) return "full";
    set([...state, p]);
    return "pinned";
  },
  /** Unpinning offers Undo for a few seconds. */
  unpin(p: Pin, title = "item") {
    const index = state.findIndex((x) => same(x, p));
    if (index < 0) return;
    set(state.filter((x) => !same(x, p)));
    undo.show(`Unpinned "${title}"`, {
      onUndo: () => { if (state.length < MAX_PINS && !state.some((x) => same(x, p))) { const next = [...state]; next.splice(Math.min(index, next.length), 0, p); set(next); } },
      commit: () => {},
    });
  },
  /** Drops pins whose item is gone or finished. Quiet, with no Undo. */
  prune(keep: (p: Pin) => boolean) {
    const next = state.filter(keep);
    if (next.length !== state.length) set(next);
  },
};

export const usePins = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
