import { RANK, rankLabel } from "./clubRoles";
import type { Org } from "./campusOrgs";

/** Everyone in a club, in order: the president, then each role from the top of the list down, then the team with no role, then members. */
export type Person = { id: string; name: string; rank: number; roleId?: string; roleName?: string; self: boolean };
export type Section = { rank: number; label: string; people: Person[] };

/** Pure: the club's people as one list, each with where they stand. */
export function buildPeople(org: Pick<Org, "members" | "clubMembers">): Person[] {
  const team: Person[] = org.members.map((m) => ({ id: m.id, name: m.name, rank: m.rank, roleId: m.roleId, roleName: m.role === "owner" ? "President" : m.title, self: m.name === "You" }));
  const onTeam = new Set(team.map((p) => p.id));
  const rest: Person[] = org.clubMembers.filter((m) => !onTeam.has(m.id)).map((m) => ({ id: m.id, name: m.name, rank: RANK.member, self: m.name === "You" }));
  return [...team, ...rest];
}

/** Pure: the list cut into sections by rank, most powerful first, each person alphabetically. A search keeps people whose name or role matches. */
export function sectionsOf(people: Person[], needle = ""): Section[] {
  const n = needle.trim().toLowerCase();
  const kept = people.filter((p) => !n || p.name.toLowerCase().includes(n) || rankLabel(p.rank, p.roleName).toLowerCase().includes(n));
  const ranks = [...new Set(kept.map((p) => p.rank))].sort((a, b) => a - b);
  return ranks.map((rank) => {
    const people = kept.filter((p) => p.rank === rank).sort((a, b) => a.name.localeCompare(b.name));
    return { rank, label: rank === RANK.member ? "Members" : rankLabel(rank, people[0]?.roleName), people };
  });
}
