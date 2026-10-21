import { useEffect, useSyncExternalStore } from "react";
import { feedApi } from "./feedData";

/** Campus map data, per university. (Checked campuses live in src/data/campuses; see below.) The student's campus comes from their account (the same membership the feed uses).
 *  A campus we have curated gets its hand-checked place list. Any other campus is looked up in OpenStreetMap the first time someone opens the map,
 *  then kept on this device. Place names and positions come from OpenStreetMap; hours and descriptions are only added by hand.
 *  The shapes match what `campuses` and `places` tables would hold, so a server import job can replace the live lookup later. */
export type PlaceCategory = "dining" | "study" | "residence" | "class" | "fun" | "outdoors" | "services" | "transit" | "other";
export type Place = { id: string; name: string; category: PlaceCategory; lat: number; lng: number; blurb?: string; hours?: string; /** OpenStreetMap element this came from, for fixing it at the source. */ osm?: string };
export type Campus = { key: string; name: string; center: [number, number]; zoom: number; /** The university's own map, for floor plans and anything this one lacks. */ officialMapUrl?: string };

export const CATEGORY: Record<PlaceCategory, { label: string }> = {
  dining: { label: "Food" }, study: { label: "Study" }, residence: { label: "Residence" }, class: { label: "Classes" }, fun: { label: "Events" },
  outdoors: { label: "Sports" }, services: { label: "Services" }, transit: { label: "Getting around" }, other: { label: "Campus building" },
};

/** Campuses with a checked place list. Keys match the campus key stored with a student's membership. */
type CampusFile = { reviewed: boolean; campus: Campus; places: Place[] };
/** Every file in src/data/campuses is a campus we have loaded ahead of time (see scripts/import-campus.mjs). Adding a campus is adding a file.
 *  "reviewed" says whether a person has checked the categories and removed non-student places. */
const files = import.meta.glob<CampusFile>("../data/campuses/*.json", { eager: true, import: "default" });
const curated: Record<string, CampusFile> = Object.fromEntries(Object.values(files).map((f) => [f.campus.key, f]));

/** A first guess at a category from OpenStreetMap tags and the name. It is only a guess, so unknowns stay "Campus building". */
export function guessCategory(t: Record<string, string | undefined>): PlaceCategory {
  const s = [t.amenity, t.building, t.leisure, t.highway, t.name].join(" ").toLowerCase();
  if (/dorm|residence|apartments/.test(s)) return "residence";
  if (/library/.test(s)) return "study";
  if (/cafe|restaurant|dining|food|fast_food|canteen/.test(s)) return "dining";
  if (/theatre|theater|student (center|centre|union)|arts? /.test(s)) return "fun";
  if (/athletic|gym|sports|stadium|field|pitch|fitness/.test(s)) return "outdoors";
  if (/academic|science|school|classroom|lecture|college|hall of/.test(s)) return "class";
  if (/security|health|clinic|office|bookstore|post_office/.test(s)) return "services";
  if (/bus_stop|parking|shuttle/.test(s)) return "transit";
  return "other";
}

type State = { status: "idle" | "loading" | "ready" | "none" | "error"; campus?: Campus; places: Place[]; source?: "curated" | "openstreetmap"; /** For a loaded campus: a person has checked its categories. */ reviewed?: boolean; error?: string; /** The campus was found but its building names could not be loaded right now. */ partial?: boolean };
let state: State = { status: "idle", places: [] };
const subs = new Set<() => void>();
const set = (s: State) => { state = s; subs.forEach((f) => f()); };

const CACHE = "orbit-campus-v1:";

async function fetchOsm(name: string, key: string): Promise<{ campus: Campus; places: Place[]; partial?: boolean }> {
  const gctl = new AbortController();
  const gt = setTimeout(() => gctl.abort(), 15000);
  const geo = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1`, { signal: gctl.signal }).then((r) => r.json()).finally(() => clearTimeout(gt));
  if (!geo[0]) throw new Error(`We could not find ${name} on the map.`);
  const lat = Number(geo[0].lat), lng = Number(geo[0].lon);
  let [s, n, w, e] = (geo[0].boundingbox as string[]).map(Number);
  // A campus outline can be huge or tiny; keep the search to a walkable area around its center.
  const half = 0.006;
  if (n - s > half * 4 || e - w > half * 4 || n - s < half || e - w < half) { s = lat - half; n = lat + half; w = lng - half * 1.3; e = lng + half * 1.3; }
  const bbox = `${s},${w},${n},${e}`;
  const q = `[out:json][timeout:25];(nwr["name"]["building"](${bbox});nwr["name"]["amenity"](${bbox});nwr["name"]["leisure"](${bbox});nwr["name"]["highway"="bus_stop"](${bbox}););out center tags 200;`;
  // The public Overpass servers are shared and sometimes full, so try a few before giving up.
  const mirrors = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
  let res: Response | null = null;
  for (const url of mirrors) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 20000);
    try {
      const r = await fetch(url, { method: "POST", body: new URLSearchParams({ data: q }), signal: ctl.signal });
      if (r.ok) { res = r; break; }
    } catch { /* try the next one */ } finally { clearTimeout(t); }
  }
  // Still show the campus itself when the building list is unavailable; the person can retry.
  if (!res) return { campus: { key, name, center: [lat, lng], zoom: 17 }, places: [], partial: true };
  try {
    const data = await res.json();
    const seen = new Set<string>();
    const places: Place[] = [];
    for (const el of data.elements as Array<{ type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }>) {
      const tags = el.tags;
      const c = el.center ?? (el.lat !== undefined && el.lon !== undefined ? { lat: el.lat, lon: el.lon } : null);
      if (!tags?.name || !c || tags.name === name || seen.has(tags.name)) continue;
      seen.add(tags.name);
      places.push({ id: `${el.type}-${el.id}`, name: tags.name, category: guessCategory(tags), lat: +c.lat.toFixed(6), lng: +c.lon.toFixed(6), osm: `${el.type}/${el.id}` });
    }
    places.sort((a, b) => a.name.localeCompare(b.name));
    return { campus: { key, name, center: [lat, lng], zoom: 17 }, places };
  } catch (e) { throw e; }
}

/** Loads the signed-in student's campus and its places. Safe to call from several screens; it only works once per campus. */
export async function loadMyCampus(force = false): Promise<void> {
  if (!force && (state.status === "loading" || state.status === "ready" || state.status === "none")) return;
  set({ ...state, status: "loading", error: undefined });
  try {
    const mine = await feedApi.campus();
    if (!mine) { set({ status: "none", places: [] }); return; }
    const known = curated[mine.key];
    if (known) { set({ status: "ready", campus: known.campus, places: known.places, source: "curated", reviewed: known.reviewed }); return; }
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE + mine.key) ?? "null") as { at: number; campus: Campus; places: Place[] } | null;
      if (cached && Date.now() - cached.at < 30 * 86400000 && cached.places.length > 0) { set({ status: "ready", campus: cached.campus, places: cached.places, source: "openstreetmap" }); return; }
    } catch { /* ignore a bad cache */ }
    const fresh = await fetchOsm(mine.name, mine.key);
    if (!fresh.partial) { try { localStorage.setItem(CACHE + mine.key, JSON.stringify({ at: Date.now(), campus: fresh.campus, places: fresh.places })); } catch { /* ignore */ } }
    set({ status: "ready", campus: fresh.campus, places: fresh.places, source: "openstreetmap", partial: fresh.partial });
  } catch (e) {
    set({ status: "error", places: [], error: (e as Error).name === "AbortError" ? "The map data took too long to load." : (e as Error).message || "Could not load the map." });
  }
}

/** Forget the loaded campus, for example right after someone joins a different one. The next screen that needs it loads the new one. */
export function resetCampus() { set({ status: "idle", places: [] }); }

export const useCampusData = () => {
  const s = useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
  useEffect(() => { void loadMyCampus(); }, []);
  return s;
};
