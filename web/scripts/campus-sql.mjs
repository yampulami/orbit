// Turns a campus file into SQL you can run once in Supabase, so that campus's places live in the database.
//
//   node scripts/campus-sql.mjs caldwell-university > caldwell.sql
//
// Run the output with the service role (the Supabase SQL editor does this): it loads the campus and its places as live, and running it again
// updates them instead of duplicating. Needs the tables from supabase/migrations/20261021120000_hangouts_reminders_places_push.sql.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const key = process.argv[2];
if (!key || !/^[a-z0-9-]{2,100}$/.test(key)) { console.error("Usage: node scripts/campus-sql.mjs <campus-key>   (for example caldwell-university)"); process.exit(1); }

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "campuses", `${key}.json`);
let data;
try { data = JSON.parse(readFileSync(file, "utf8")); } catch { console.error(`No campus file at ${file}`); process.exit(1); }

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const n = (x) => { const v = Number(x); if (!Number.isFinite(v)) throw new Error(`Not a number: ${x}`); return v; };
const CATEGORIES = new Set(["dining", "study", "residence", "class", "fun", "outdoors", "services", "transit", "other"]);

const c = data.campus;
const out = [];
out.push(`-- Campus ${c.name} (${data.reviewed ? "reviewed" : "NOT reviewed: categories are guesses"})`);
out.push("begin;");
out.push(`insert into public.campuses (campus_key, name, center_lat, center_lng, zoom, reviewed) values (${q(c.key)}, ${q(c.name)}, ${n(c.center[0])}, ${n(c.center[1])}, ${n(c.zoom)}, ${data.reviewed ? "true" : "false"})
on conflict (campus_key) do update set name = excluded.name, center_lat = excluded.center_lat, center_lng = excluded.center_lng, zoom = excluded.zoom, reviewed = excluded.reviewed;`);

const rows = data.places.map((p) => {
  if (!CATEGORIES.has(p.category)) throw new Error(`Unknown category "${p.category}" for ${p.name}`);
  if (!p.osm) throw new Error(`${p.name} has no osm reference, so it cannot be re-imported safely`);
  return `  (${q(c.key)}, ${q(p.name)}, ${q(p.category)}, ${n(p.lat)}, ${n(p.lng)}, ${p.blurb ? q(p.blurb) : "null"}, ${p.hours ? q(p.hours) : "null"}, ${q(p.osm)}, 'live', 'osm')`;
});
if (rows.length) {
  out.push(`insert into public.campus_places (campus_key, name, category, lat, lng, blurb, hours, osm_ref, status, source) values\n${rows.join(",\n")}
on conflict (campus_key, osm_ref) where osm_ref is not null do update set name = excluded.name, category = excluded.category, lat = excluded.lat, lng = excluded.lng, blurb = excluded.blurb, hours = excluded.hours;`);
}
out.push("commit;");
console.log(out.join("\n"));
console.error(`${rows.length} places for ${c.name}.`);
