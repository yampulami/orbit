import { useSyncExternalStore } from "react";

/** The plan the feed's headline is already asking about, so the list of waiting plans below does not repeat it. */
let current: string | null = null;
const subs = new Set<() => void>();
export const leadPlan = {
  set(id: string | null) { if (id !== current) { current = id; subs.forEach((f) => f()); } },
};
export const useLeadPlan = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => current);
