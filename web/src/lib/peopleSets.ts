/** The people you can pull into a group, gathered from the places you already know them: friends, dorm mates, circles and your other hangout groups. */
export type Pick = { id: string; name: string };
export type SetKey = "friends" | "dorm" | "circles" | "hangouts";
export type PeopleSet = { key: SetKey; label: string; people: Pick[] };

type Input = {
  friends: Pick[];
  dorm: string[];
  circles: { name: string; people: string[] }[];
  groups: { name: string; members: string[] }[];
  /** Names that are already you, or already in: left out. */
  exclude?: string[];
};

const norm = (n: string) => n.trim().toLowerCase();

/** Pure: sets of people, each person once per set, nobody excluded, empty sets left out. A name found only as text gets its name as its id. */
export function buildPeopleSets({ friends, dorm, circles, groups, exclude = [] }: Input): PeopleSet[] {
  const skip = new Set(exclude.map(norm));
  const idOf = new Map(friends.map((f) => [norm(f.name), f.id]));
  const pick = (name: string): Pick => ({ id: idOf.get(norm(name)) ?? name, name });
  const clean = (names: string[]) => {
    const seen = new Set<string>();
    return names.filter((n) => { const k = norm(n); if (!k || skip.has(k) || seen.has(k)) return false; seen.add(k); return true; }).map(pick);
  };
  const sets: PeopleSet[] = [
    { key: "friends", label: "Friends", people: clean(friends.map((f) => f.name)) },
    { key: "dorm", label: "Dorm mates", people: clean(dorm) },
    { key: "circles", label: "Circles", people: clean(circles.flatMap((c) => c.people)) },
    { key: "hangouts", label: "Hangout groups", people: clean(groups.flatMap((g) => g.members)) },
  ];
  return sets.filter((s) => s.people.length > 0);
}

/** Pure: everyone across the sets, once. */
export function everyone(sets: PeopleSet[]): Pick[] {
  const seen = new Set<string>();
  return sets.flatMap((s) => s.people).filter((p) => { const k = norm(p.name); if (seen.has(k)) return false; seen.add(k); return true; });
}
