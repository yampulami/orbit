/** Search over the open list of universities (public/data/universities.json, refreshed with `npm run universities:update`).
 *  The list is fetched once, the first time someone starts typing, then searched in memory so suggestions appear from the first letter. */
export type University = { name: string; country: string; region: string; domain: string };

let cache: University[] | null = null;
let loading: Promise<University[]> | null = null;

export function loadUniversities(): Promise<University[]> {
  if (cache) return Promise.resolve(cache);
  loading ??= fetch(`${import.meta.env.BASE_URL}data/universities.json`)
    .then((r) => { if (!r.ok) throw new Error("Could not load the university list."); return r.json() as Promise<string[][]>; })
    .then((rows) => (cache = rows.map(([name, country, region, domain]) => ({ name, country, region, domain }))))
    .catch((e) => { loading = null; throw e; });
  return loading;
}

const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
const words = (s: string) => fold(s).split(/[^a-z0-9]+/).filter(Boolean);

/** The region to list first, from the browser language (en-US gives US). */
export function preferredCountry(): string {
  try { const m = /-([A-Za-z]{2})\b/.exec(navigator.language); if (m) return m[1].toUpperCase(); } catch { /* ignore */ }
  return "US";
}

/** Universities for what was typed so far. Every typed word must start a word in the name. Names that start with what you typed come first,
 *  then names where the words appear anywhere, with the preferred country and shorter names winning ties. Works from a single letter. */
export function searchUniversities(list: University[], query: string, limit = 8, country = "US"): University[] {
  const q = fold(query).trim();
  if (!q) return [];
  const tokens = words(query);
  if (tokens.length === 0) return [];
  const scored: { u: University; score: number }[] = [];
  for (const u of list) {
    const name = fold(u.name);
    const w = words(u.name);
    // Each typed word has to begin some word of the name.
    if (!tokens.every((t) => w.some((x) => x.startsWith(t)))) continue;
    let score = 3;
    if (name === q) score = 0;
    else if (name.startsWith(q)) score = 1;
    else if (w[0] === "university" || w[0] === "the") score = w.slice(1).join(" ").startsWith(tokens.join(" ")) || (w[1] === "of" && w.slice(2).join(" ").startsWith(tokens.join(" "))) ? 1.5 : 2;
    else if (tokens.length > 1 && name.includes(q)) score = 2;
    scored.push({ u, score });
  }
  scored.sort((a, b) => a.score - b.score || Number(b.u.country === country) - Number(a.u.country === country) || a.u.name.length - b.u.name.length || a.u.name.localeCompare(b.u.name));
  return scored.slice(0, limit).map((s) => s.u);
}

/** "New Jersey, US" or just "US". */
export const placeOf = (u: University) => [u.region, u.country].filter(Boolean).join(", ");
