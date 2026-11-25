import type { Alum, OpenTo } from "./alumni";
import type { ClubRef } from "./alumniClubs";

export type AlumFilters = { q: string; want: OpenTo | ""; company: string; club: string };

/** Where people work, most represented first. Spelling differences in capitals count as one place. */
export function companiesOf(list: Pick<Alum, "company">[]): { name: string; count: number }[] {
  const found = new Map<string, { name: string; count: number }>();
  for (const a of list) {
    const name = a.company.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const had = found.get(key);
    found.set(key, { name: had?.name ?? name, count: (had?.count ?? 0) + 1 });
  }
  return [...found.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function matchesAlum(a: Alum, f: AlumFilters, clubs: ClubRef[]): boolean {
  if (f.want && !a.openTo.includes(f.want)) return false;
  if (f.company && a.company.trim().toLowerCase() !== f.company.toLowerCase()) return false;
  if (f.club && !clubs.some((c) => c.id === f.club)) return false;
  const t = f.q.trim().toLowerCase();
  return !t || [a.name, a.company, a.jobTitle, a.industry, a.field, String(a.gradYear), ...clubs.map((c) => c.name)].some((x) => x.toLowerCase().includes(t));
}

/** People who share a club with you come first (the warmest introduction), then the most recent graduates. */
export function orderAlumni(list: Alum[], byPerson: Map<string, ClubRef[]>): Alum[] {
  const shared = (a: Alum) => (byPerson.get(a.id) ?? []).filter((c) => c.mine).length;
  return [...list].sort((a, b) => shared(b) - shared(a) || b.gradYear - a.gradYear || a.name.localeCompare(b.name));
}
