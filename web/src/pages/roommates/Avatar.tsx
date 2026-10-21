import { toneOf } from "../../lib/roommates";

/** A roommate's initial on their own pastel. The color comes from their place in the household. */
export function Avatar({ name, members, size = 28 }: { name: string; members: string[]; size?: number }) {
  return <span className="mini" aria-hidden="true" style={{ background: toneOf(name, members), width: size, height: size, fontSize: size * 0.42 }}>{name.slice(0, 1).toUpperCase()}</span>;
}

export function memberOptions(members: string[], size = 24) {
  return members.map((m) => ({ value: m, label: m, icon: <Avatar name={m} members={members} size={size} /> }));
}
