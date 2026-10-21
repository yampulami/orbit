// Adds a campus to the app: finds it on OpenStreetMap, pulls its named buildings and writes src/data/campuses/<key>.json.
//
//   npm run campus:add -- "Montclair State University"
//   npm run campus:add -- "Some University" --bbox 40.83,-74.28,40.84,-74.26     (south,west,north,east, if the lookup picks the wrong area)
//   npm run campus:add -- "Some University" --print                              (show it instead of writing the file)
//
// The file is a draft: names and positions are real, but categories are guesses from OpenStreetMap tags, and there are no hours or descriptions.
// It is saved with "reviewed": false, which makes the app say so. Open the file, fix the categories you can, delete anything that is not a
// student place, then set "reviewed" to true. Data is (c) OpenStreetMap contributors, ODbL; the map keeps the attribution.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const UA = { "User-Agent": "orbit-campus-import/0.1 (student project)" };
const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--"));
const flag = (f) => args.includes(f);
const bboxIdx = args.indexOf("--bbox");
if (!name) { console.error('Usage: npm run campus:add -- "University name" [--bbox s,w,n,e] [--print]'); process.exit(1); }

const key = name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "campuses", `${key}.json`);
if (!flag("--print") && !flag("--force") && existsSync(out)) { console.error(`${out} already exists. Pass --force to replace it (this discards any hand edits).`); process.exit(1); }

const geo = await (await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1`, { headers: UA })).json();
if (!geo[0]) { console.error("Could not find that campus on Nominatim. Check the spelling or pass --bbox."); process.exit(1); }
const lat = Number(geo[0].lat), lng = Number(geo[0].lon);
let bbox = bboxIdx >= 0 ? args[bboxIdx + 1].split(",").map(Number) : null;
if (!bbox) {
  let [s, n, w, e] = geo[0].boundingbox.map(Number);
  const half = 0.006; // keep to a walkable area when the outline is huge or tiny
  if (n - s > half * 4 || e - w > half * 4 || n - s < half || e - w < half) { s = lat - half; n = lat + half; w = lng - half * 1.3; e = lng + half * 1.3; }
  bbox = [s, w, n, e];
}
const b = bbox.join(",");
const q = `[out:json][timeout:60];(nwr["name"]["building"](${b});nwr["name"]["amenity"](${b});nwr["name"]["leisure"](${b});nwr["name"]["highway"="bus_stop"](${b}););out center tags 300;`;

const mirrors = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
let data = null;
for (const url of mirrors) {
  for (let attempt = 0; attempt < 2 && !data; attempt++) {
    try {
      const r = await fetch(url, { method: "POST", headers: { ...UA, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams({ data: q }) });
      if (r.ok) data = await r.json();
      else { console.error(`${url} answered ${r.status}, waiting a bit.`); await new Promise((res) => setTimeout(res, 4000)); }
    } catch (e) { console.error(`${url} failed: ${e.message}`); }
  }
  if (data) break;
}
if (!data) { console.error("All the public map servers are busy. Try again in a few minutes."); process.exit(1); }

const guess = (t) => {
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
};

const seen = new Set();
const places = [];
for (const e of data.elements) {
  const c = e.center ?? (e.lat !== undefined ? { lat: e.lat, lon: e.lon } : null);
  if (!e.tags?.name || !c || e.tags.name === name || seen.has(e.tags.name)) continue;
  seen.add(e.tags.name);
  places.push({ id: `${e.type}-${e.id}`, name: e.tags.name, category: guess(e.tags), lat: +c.lat.toFixed(6), lng: +c.lon.toFixed(6), osm: `${e.type}/${e.id}` });
}
places.sort((a, b2) => a.name.localeCompare(b2.name));

const file = { reviewed: false, campus: { key, name, center: [+lat.toFixed(5), +lng.toFixed(5)], zoom: 17 }, places };
if (flag("--print")) { console.log(JSON.stringify(file, null, 2)); }
else { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(file, null, 2) + "\n"); console.error(`Wrote ${out}`); }
console.error(`${places.length} places for ${name}. Review the categories, then set "reviewed": true.`);
