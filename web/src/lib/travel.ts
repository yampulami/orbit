import type { ClassSlot } from "./classes";
import { toMinutes } from "./classes";

/** Walking time between campus places, so a suggested time leaves room to get there. Pure. */
type Spot = { name: string; lat: number; lng: number };

const WALK_M_PER_MIN = 80; // a normal walking pace
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Straight-line distance between two points in metres. */
export function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Minutes to walk between two places (at least 2, rounded up), or 0 if they are the same spot. */
export function walkMinutes(a: Spot, b: Spot): number {
  const d = metres(a, b);
  return d < 25 ? 0 : Math.max(2, Math.ceil(d / WALK_M_PER_MIN));
}

/** The campus place a class's "where" refers to, if one matches by name ("Albright Hall 302" matches a place called "Albright Hall"). */
export function spotFor(where: string | undefined, places: Spot[]): Spot | undefined {
  const w = norm(where ?? "");
  if (w.length < 3) return undefined;
  return places.find((p) => norm(p.name) === w) ?? places.find((p) => w.includes(norm(p.name)) && norm(p.name).length >= 4) ?? places.find((p) => norm(p.name).includes(w) && w.length >= 4);
}

const clamp = (m: number) => Math.max(0, Math.min(24 * 60, m));
const hhmm = (m: number) => { const x = clamp(m); return x >= 1440 ? "23:59" : `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };

/** Give each class extra room, before and after, for the walk between its building and the place you plan to meet. Classes whose building is not on the map are left as they are.
 *  Capped at 25 minutes each side. Returns the padded classes and the longest walk that was added. */
export function padForTravel(classes: ClassSlot[], places: Spot[], meet: Spot): { classes: ClassSlot[]; longest: number } {
  let longest = 0;
  const padded = classes.map((c) => {
    const spot = spotFor(c.place, places);
    if (!spot) return c;
    const walk = Math.min(25, walkMinutes(spot, meet));
    if (walk === 0) return c;
    longest = Math.max(longest, walk);
    return { ...c, start: hhmm(toMinutes(c.start) - walk), end: hhmm(toMinutes(c.end) + walk) };
  });
  return { classes: padded, longest };
}
