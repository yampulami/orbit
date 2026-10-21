// Downloads the open list of universities (Hipo/university-domains-list, public data) and writes a trimmed copy the app searches while a
// student types their university: public/data/universities.json, as rows of [name, country code, state or province, main email domain].
//
//   npm run universities:update
//
// The app serves this file itself, so the search works instantly and does not depend on a third-party server being up.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE = "https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json";
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "data", "universities.json");

const res = await fetch(SOURCE);
if (!res.ok) { console.error(`Could not download the list (${res.status}).`); process.exit(1); }
const all = await res.json();

const seen = new Set();
const rows = [];
for (const u of all) {
  const name = (u.name ?? "").trim();
  if (!name) continue;
  const key = `${name.toLowerCase()}|${u.alpha_two_code ?? ""}`;
  if (seen.has(key)) continue;
  seen.add(key);
  rows.push([name, u.alpha_two_code ?? "", u["state-province"] ?? "", u.domains?.[0] ?? ""]);
}
rows.sort((a, b) => a[0].localeCompare(b[0]));

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(rows));
console.error(`Wrote ${rows.length} universities to ${out}`);
