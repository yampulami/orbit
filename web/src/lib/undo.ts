import { useSyncExternalStore } from "react";

/** Undo-first deleting: the item disappears at once, and the real delete waits a few seconds so it can be taken back. */
type Item = { id: number; message: string; onUndo: () => void; commit: () => void | Promise<void>; timer: ReturnType<typeof setTimeout> };

let items: Item[] = [];
let next = 1;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

function finish(id: number, commit: boolean) {
  const it = items.find((x) => x.id === id);
  if (!it) return;
  clearTimeout(it.timer);
  items = items.filter((x) => x.id !== id);
  emit();
  if (commit) {
    // If the real delete fails, put the item back instead of losing track of it.
    Promise.resolve()
      .then(() => it.commit())
      .catch(() => it.onUndo());
  } else {
    it.onUndo();
  }
}

export const undo = {
  show(message: string, o: { onUndo: () => void; commit: () => void | Promise<void>; ms?: number }): number {
    const id = next++;
    const timer = setTimeout(() => finish(id, true), o.ms ?? 6000);
    items = [...items, { id, message, onUndo: o.onUndo, commit: o.commit, timer }];
    emit();
    return id;
  },
  undo: (id: number) => finish(id, false),
  dismiss: (id: number) => finish(id, true),
  flushAll() { [...items].forEach((x) => finish(x.id, true)); },
};

// Closing the tab inside the undo window should still delete what the person deleted.
if (typeof window !== "undefined") window.addEventListener("pagehide", () => undo.flushAll());

export const useUndo = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => items);
