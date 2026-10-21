import { useSyncExternalStore } from "react";
import { YOU } from "./hangouts";
import type { PlaceCategory } from "./campus";

/** Places students add to the map and confirm for each other. A proposal goes live once enough different students agree it is right.
 *  Saved on this device only for now; the shape matches a `place_proposals` and `place_votes` table, so it can move to Supabase. */
export type Vote = 1 | -1;
export type Proposal = { id: string; campusKey: string; name: string; category: PlaceCategory; lat: number; lng: number; details?: string; by: string; at: string; votes: Record<string, Vote> };

/** How many different students must confirm, and what share of the votes must agree. */
export const NEEDED = 3;
export const SHARE = 0.7;
const DAILY_LIMIT = 5;

export type Status = "open" | "accepted" | "rejected";

export function tally(p: Pick<Proposal, "votes">) {
  const v = Object.values(p.votes);
  return { yes: v.filter((x) => x === 1).length, no: v.filter((x) => x === -1).length };
}

/** Live once at least NEEDED people confirmed and at least SHARE of the votes agree. Dropped once NEEDED people say it is wrong and they lead. */
export function statusOf(p: Pick<Proposal, "votes">): Status {
  const { yes, no } = tally(p);
  if (yes >= NEEDED && yes / (yes + no) >= SHARE) return "accepted";
  if (no >= NEEDED && no > yes) return "rejected";
  return "open";
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** Rough distance in meters between two points, enough to tell "the same building". */
export function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dy = (a.lat - b.lat) * 111320, dx = (a.lng - b.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dx, dy);
}
export const sameSpot = (a: { name: string; lat: number; lng: number }, b: { name: string; lat: number; lng: number }) => norm(a.name) === norm(b.name) && meters(a, b) < 60;

const KEY = "orbit-place-proposals-v1";
const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString();

/** A couple of proposals from other students, so there is something to confirm when you open the map in demo mode. */
function seed(): Proposal[] {
  return [
    { id: "pp1", campusKey: "caldwell-university", name: "The quad", category: "outdoors", lat: 40.83345, lng: -74.27345, details: "Open lawn where people hang out when it is nice out.", by: "Maya", at: ago(30), votes: { Maya: 1, Jordan: 1 } },
    { id: "pp2", campusKey: "caldwell-university", name: "Coffee cart", category: "dining", lat: 40.83315, lng: -74.27215, details: "Outside the student center on weekday mornings.", by: "Leo", at: ago(8), votes: { Leo: 1 } },
  ];
}

function load(): Proposal[] {
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s) as Proposal[]; } catch { /* storage unavailable */ }
  return seed();
}

let state: Proposal[] = load();
const subs = new Set<() => void>();
function set(next: Proposal[]) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  subs.forEach((f) => f());
}

export type ProposeResult = { ok: true; id: string } | { ok: false; reason: "name" | "limit" | "duplicate"; existing?: string };

export const proposalActions = {
  propose(o: { campusKey: string; name: string; category: PlaceCategory; lat: number; lng: number; details?: string }, existing: { id: string; name: string; lat: number; lng: number }[]): ProposeResult {
    const name = o.name.trim();
    if (name.length < 2 || name.length > 60) return { ok: false, reason: "name" };
    const recent = state.filter((p) => p.by === YOU && Date.now() - new Date(p.at).getTime() < 86400000).length;
    if (recent >= DAILY_LIMIT) return { ok: false, reason: "limit" };
    const dup = existing.find((p) => sameSpot(p, { name, lat: o.lat, lng: o.lng }));
    if (dup) return { ok: false, reason: "duplicate", existing: dup.id };
    const id = crypto.randomUUID();
    set([...state, { id, campusKey: o.campusKey, name, category: o.category, lat: o.lat, lng: o.lng, details: o.details?.trim().slice(0, 200) || undefined, by: YOU, at: new Date().toISOString(), votes: { [YOU]: 1 } }]);
    return { ok: true, id };
  },
  /** Confirm (1), say it is wrong (-1), or take the vote back (null). You cannot change the vote on your own proposal. */
  vote(id: string, v: Vote | null) {
    set(state.map((p) => {
      if (p.id !== id || p.by === YOU) return p;
      const votes = { ...p.votes };
      if (v === null) delete votes[YOU]; else votes[YOU] = v;
      return { ...p, votes };
    }));
  },
  /** Only the person who added it can take it back, and only while it is still open. */
  withdraw(id: string) {
    set(state.filter((p) => !(p.id === id && p.by === YOU && statusOf(p) === "open")));
  },
};

export const useProposals = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
