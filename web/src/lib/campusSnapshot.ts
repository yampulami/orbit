import { supabase } from "./supabase";

/** Counts only, from the database function `campus_snapshot`: what is going on at a campus, shown before you have joined it. */
export type Snapshot = { events: number; clubs: number; students: number | null };

export async function loadSnapshot(campusKey: string): Promise<Snapshot | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("campus_snapshot", { p_key: campusKey });
  if (error || !data || typeof data !== "object") return null;
  const d = data as { events?: unknown; clubs?: unknown; students?: unknown };
  const n = (v: unknown) => (typeof v === "number" && v >= 0 ? v : 0);
  return { events: n(d.events), clubs: n(d.clubs), students: typeof d.students === "number" ? d.students : null };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** A short line for the setup card, or null when there is nothing to say yet (a brand new campus). */
export function snapshotLine(s: Snapshot | null): string | null {
  if (!s) return null;
  const parts: string[] = [];
  if (s.events > 0) parts.push(`${plural(s.events, "event", "events")} in the next two weeks`);
  if (s.clubs > 0) parts.push(plural(s.clubs, "club", "clubs"));
  if (s.students) parts.push(plural(s.students, "student", "students") + " on Orbit");
  if (parts.length === 0) return null;
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
