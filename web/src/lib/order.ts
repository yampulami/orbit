import { useCallback, useState } from "react";

/** Pure: put items in the order you saved. Anything you have not placed yet keeps its own order, after the ones you have. */
export function applyOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  const placed = items.filter((x) => rank.has(x.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  return [...placed, ...items.filter((x) => !rank.has(x.id))];
}

const read = (key: string): string[] => {
  try { const v = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
};

/** The order you arranged something in, kept on this device. */
export function useSavedOrder(key: string): [string[], (ids: string[]) => void] {
  const [order, setOrder] = useState<string[]>(() => read(key));
  const save = useCallback((ids: string[]) => {
    setOrder(ids);
    try { localStorage.setItem(key, JSON.stringify(ids)); } catch { /* it still works for now */ }
  }, [key]);
  return [order, save];
}
