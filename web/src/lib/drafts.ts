import { useSyncExternalStore } from "react";
import type { Community } from "../shared/feed";

/** Posts you started and closed without sending. Saved on this device only. */
export type Draft = { id: string; text: string; community: Community; at: string };

const KEY = "orbit-drafts-v1";

function load(): Draft[] {
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s) as Draft[]; } catch { /* storage unavailable */ }
  return [];
}

let state: Draft[] = load();
const subs = new Set<() => void>();
function set(next: Draft[]) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  subs.forEach((f) => f());
}

export const draftActions = {
  save(text: string, community: Community) {
    const id = crypto.randomUUID();
    set([{ id, text, community, at: new Date().toISOString() }, ...state].slice(0, 20));
    return id;
  },
  remove(id: string) { set(state.filter((d) => d.id !== id)); },
};

export const useDrafts = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
