import type { Org } from "./campusOrgs";

export type ClubRef = { id: string; name: string; mine: boolean };

/** For each person, the active clubs and circles they are in, as a member or an officer. Yours come first, then by name. */
export function clubsByPerson(orgs: Pick<Org, "id" | "name" | "status" | "mine" | "members" | "clubMembers" | "myJoin">[]): Map<string, ClubRef[]> {
  const out = new Map<string, ClubRef[]>();
  for (const o of orgs) {
    if (o.status !== "active") continue;
    const ref = { id: o.id, name: o.name, mine: o.mine || o.myJoin === "member" };
    for (const id of new Set([...o.members.map((m) => m.id), ...o.clubMembers.map((m) => m.id)])) out.set(id, [...(out.get(id) ?? []), ref]);
  }
  for (const list of out.values()) list.sort((a, b) => Number(b.mine) - Number(a.mine) || a.name.localeCompare(b.name));
  return out;
}

/** The clubs that have at least one of these people, with how many, yours first. For the directory's club filter. */
export function clubChoices(people: string[], byPerson: Map<string, ClubRef[]>): (ClubRef & { count: number })[] {
  const found = new Map<string, ClubRef & { count: number }>();
  for (const p of new Set(people)) for (const c of byPerson.get(p) ?? []) found.set(c.id, { ...c, count: (found.get(c.id)?.count ?? 0) + 1 });
  return [...found.values()].sort((a, b) => Number(b.mine) - Number(a.mine) || a.name.localeCompare(b.name));
}
