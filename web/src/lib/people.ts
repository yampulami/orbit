import { supabase } from "./supabase";
import { YOU } from "./hangTypes";

/** Shared helpers for showing people from the database the way the screens expect: by display name, with "You" for the signed-in student. */

/** A function that names a user. Two different people with the same display name get a short suffix so they stay apart. */
export function makeLabeler(me: string, ids: Iterable<string>, names: Record<string, string>, fallback: (id: string) => string | undefined = () => undefined) {
  const base = (id: string) => (names[id] ?? fallback(id) ?? "Student").trim() || "Student";
  const count = new Map<string, number>();
  for (const id of new Set(ids)) if (id !== me) count.set(base(id), (count.get(base(id)) ?? 0) + 1);
  return (id: string) => (id === me ? YOU : (count.get(base(id)) ?? 0) > 1 ? `${base(id)} ${id.slice(0, 4)}` : base(id));
}

/** Display names for some user ids, from the student profiles on the same campus. */
export async function loadNames(userIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return {};
  const { data, error } = await supabase!.from("student_profiles").select("user_id,display_name").in("user_id", ids);
  if (error) throw new Error(error.message);
  const out: Record<string, string> = {};
  ((data ?? []) as { user_id: string; display_name: string }[]).forEach((p) => { out[p.user_id] = p.display_name; });
  return out;
}

/** Call `onChange` (shortly after, and once for a burst) whenever any of these tables change. Returns a function that stops listening. */
export function watchTables(name: string, tables: string[], onChange: () => void): () => void {
  const sb = supabase!;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const soon = () => { clearTimeout(timer); timer = setTimeout(onChange, 250); };
  const ch = sb.channel(`${name}-${Math.random().toString(36).slice(2, 8)}`);
  for (const table of tables) ch.on("postgres_changes", { event: "*", schema: "public", table }, soon);
  ch.subscribe();
  return () => { clearTimeout(timer); void sb.removeChannel(ch); };
}
