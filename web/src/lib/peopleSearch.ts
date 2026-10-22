import { supabase } from "./supabase";

/** Searching for students from the search bar: by name or by username, as you type. */
export type PersonHit = { id: string; name: string; username: string | null };
type Row = { user_id: string; display_name: string; username: string | null };

/** What was typed, understood: a leading @ means "look for a username"; anything else looks at names and usernames both. */
export function parseQuery(q: string): { term: string; usernameOnly: boolean } {
  const t = q.trim();
  const usernameOnly = t.startsWith("@");
  return { term: t.replace(/^@+/, "").trim().toLowerCase(), usernameOnly };
}

/** Is there enough typed to start looking? Two letters for a plain search, one after an @. */
export const longEnough = (q: string) => { const { term, usernameOnly } = parseQuery(q); return term.length >= (usernameOnly ? 1 : 2); };

/** Keep only what is safe to put in a search pattern: letters, numbers, underscore, dot and spaces. */
const safe = (term: string) => term.replace(/[^\p{L}\p{N}_. ]/gu, "").trim();

/** Pure: put the best matches first. A username or name that starts with what was typed beats one that only contains it, an exact
 *  username beats both, and ties go alphabetically. */
export function rankPeople(rows: Row[], term: string, usernameOnly: boolean, me?: string): PersonHit[] {
  const t = term.toLowerCase();
  const score = (r: Row) => {
    const u = (r.username ?? "").toLowerCase(), n = r.display_name.toLowerCase();
    if (u === t) return 0;
    if (u.startsWith(t)) return 1;
    if (!usernameOnly && n.startsWith(t)) return 2;
    if (!usernameOnly && n.split(" ").some((w) => w.startsWith(t))) return 3;
    if (u.includes(t)) return 4;
    if (!usernameOnly && n.includes(t)) return 5;
    return 9;
  };
  return rows
    .filter((r) => r.user_id !== me && score(r) < 9)
    .sort((a, b) => score(a) - score(b) || a.display_name.localeCompare(b.display_name))
    .map((r) => ({ id: r.user_id, name: r.display_name, username: r.username }));
}

/** Students on your campus whose name or username matches. The rules in the database only ever show your own campus. */
export async function searchPeople(q: string, me?: string, limit = 6): Promise<PersonHit[]> {
  if (!supabase || !longEnough(q)) return [];
  const { term, usernameOnly } = parseQuery(q);
  const s = safe(term);
  if (!s) return [];
  const filter = usernameOnly ? `username.ilike.*${s}*` : `display_name.ilike.*${s}*,username.ilike.*${s}*`;
  const { data, error } = await supabase.from("student_profiles").select("user_id,display_name,username").or(filter).limit(30);
  if (error) return [];
  return rankPeople((data ?? []) as Row[], s, usernameOnly, me).slice(0, limit);
}
