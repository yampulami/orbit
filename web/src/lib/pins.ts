import { useSyncExternalStore } from "react";
import { undo } from "./undo";
import { supabase } from "./supabase";
import { dbRun, loadPins, refreshOnReturn } from "./privateDb";

/** Things you marked as very important: a few hangouts, reminders or chores, shown first on Home. With a database they follow you between devices; without one they are saved on this device. */
export type PinKind = "hangout" | "reminder" | "chore";
export type Pin = { kind: PinKind; id: string };
export const MAX_PINS = 3;

const KEY = "orbit-pins-v1";
const same = (a: Pin, b: Pin) => a.kind === b.kind && a.id === b.id;

function load(): Pin[] {
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s) as Pin[]; } catch { /* storage unavailable */ }
  return [];
}

const live = !!supabase;
let state: Pin[] = live ? [] : load();
const subs = new Set<() => void>();
function set(next: Pin[]) {
  state = next;
  if (!live) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }
  subs.forEach((f) => f());
}

/* ---------- database mode: pins follow the signed-in student between devices ---------- */
let owner: string | null = null;
let stopRefresh: (() => void) | null = null;
async function reload() {
  if (!owner) return;
  const mine = owner;
  try { const next = await loadPins(); if (owner === mine) set(next); } catch { /* keep what is on screen */ }
}
export function bindPins(userId: string) {
  if (!live || owner === userId) return;
  unbindPins();
  owner = userId;
  void reload();
  stopRefresh = refreshOnReturn(() => void reload());
}
export function unbindPins() {
  if (!live) return;
  stopRefresh?.(); stopRefresh = null;
  owner = null;
  set([]);
}
const sync = (what: string, job: () => PromiseLike<{ error: { message: string } | null }>) => { if (live && owner) dbRun(what, job, () => void reload()); };

export const pinActions = {
  has: (p: Pin) => state.some((x) => same(x, p)),
  /** Pins an item, or unpins it if it is already pinned. Returns "full" when there is no room. */
  toggle(p: Pin, title = "item"): "pinned" | "unpinned" | "full" {
    if (state.some((x) => same(x, p))) { pinActions.unpin(p, title); return "unpinned"; }
    if (state.length >= MAX_PINS) return "full";
    set([...state, p]);
    sync("Pinning that", () => supabase!.from("user_pins").insert({ user_id: owner!, kind: p.kind, item_id: p.id }));
    return "pinned";
  },
  /** Unpinning offers Undo for a few seconds. */
  unpin(p: Pin, title = "item") {
    const index = state.findIndex((x) => same(x, p));
    if (index < 0) return;
    set(state.filter((x) => !same(x, p)));
    sync("Unpinning that", () => supabase!.from("user_pins").delete().eq("user_id", owner!).eq("kind", p.kind).eq("item_id", p.id));
    undo.show(`Unpinned "${title}"`, {
      onUndo: () => {
        if (state.length < MAX_PINS && !state.some((x) => same(x, p))) {
          const next = [...state]; next.splice(Math.min(index, next.length), 0, p); set(next);
          sync("Pinning that again", () => supabase!.from("user_pins").insert({ user_id: owner!, kind: p.kind, item_id: p.id }));
        }
      },
      commit: () => {},
    });
  },
  /** Drops pins whose item is gone or finished. Quiet, with no Undo. */
  prune(keep: (p: Pin) => boolean) {
    const next = state.filter(keep);
    if (next.length === state.length) return;
    const gone = state.filter((x) => !keep(x));
    set(next);
    gone.forEach((g) => sync("Clearing a finished pin", () => supabase!.from("user_pins").delete().eq("user_id", owner!).eq("kind", g.kind).eq("item_id", g.id)));
  },
};

export const usePins = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
