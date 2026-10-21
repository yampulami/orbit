import { useSyncExternalStore } from "react";
import { YOU } from "./hangouts";
import type { PlaceCategory } from "./campus";
import { supabase } from "./supabase";
import { dbRun } from "./privateDb";
import { buildProposals, loadPlaces } from "./placesDb";
import { watchTables } from "./people";

/** Places students add to the map and confirm for each other. A proposal goes live once enough different students agree it is right.
 *  With a database they are shared with everyone on the campus; without one (demo mode) they are saved on this device. */
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

const live = !!supabase;
let state: Proposal[] = live ? [] : load();
const subs = new Set<() => void>();
function set(next: Proposal[]) {
  state = next;
  if (!live) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }
  subs.forEach((f) => f());
}

/* ---------- database mode: proposals and votes are shared with everyone on the campus, live ---------- */
let who: string | null = null;
let stop: (() => void) | null = null;
let loadId = 0;
async function reload() {
  if (!who) return;
  const me = who, mine = ++loadId;
  try { const next = buildProposals(await loadPlaces(me)); if (mine === loadId && who === me) set(next); } catch { /* keep what is on screen */ }
}
export function bindPlaces(userId: string) {
  if (!live || who === userId) return;
  unbindPlaces();
  who = userId;
  void reload();
  stop = watchTables(`orbit-places-${userId}`, ["campus_places", "place_votes"], () => void reload());
}
export function unbindPlaces() {
  if (!live) return;
  stop?.(); stop = null;
  who = null; loadId++;
  set([]);
}
const sync = (what: string, job: () => PromiseLike<{ error: { message: string } | null }>) => { if (live && who) dbRun(what, job, () => void reload()); };

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
    const details = o.details?.trim().slice(0, 200) || undefined;
    set([...state, { id, campusKey: o.campusKey, name, category: o.category, lat: o.lat, lng: o.lng, details, by: YOU, at: new Date().toISOString(), votes: { [YOU]: 1 } }]);
    // The database enforces the same limits and adds your first confirmation itself.
    sync("Adding that place", () => supabase!.from("campus_places").insert({ id, campus_key: o.campusKey, name, category: o.category, lat: o.lat, lng: o.lng, blurb: details ?? null, status: "open", source: "students", created_by: who! }));
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
    if (live && who) {
      const me = who;
      sync("Saving your vote", () => (v === null
        ? supabase!.from("place_votes").delete().eq("place_id", id).eq("user_id", me)
        : supabase!.from("place_votes").upsert({ place_id: id, user_id: me, vote: v, updated_at: new Date().toISOString() })));
    }
  },
  /** Only the person who added it can take it back, and only while it is still open. */
  withdraw(id: string) {
    const mine = state.find((p) => p.id === id && p.by === YOU && statusOf(p) === "open");
    if (!mine) return;
    set(state.filter((p) => p.id !== id));
    sync("Taking that place back", () => supabase!.from("campus_places").delete().eq("id", id).eq("created_by", who!));
  },
};

export const useProposals = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
