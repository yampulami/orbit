import { supabase } from "./supabase";

/** A username is how a student is found, added and signed in: lowercase letters, numbers and underscores, 3 to 20 long, and unique across Orbit
 *  (nobody else can take yours). */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** Names nobody can take, so nobody can pose as the app. The database refuses them too. */
export const RESERVED = ["admin", "administrator", "orbit", "support", "staff", "moderator", "mod", "help", "system", "root", "official", "team"];

/** Does this look like an email address (so it is an email, not a username)? Usernames can never contain an @. */
export const looksLikeEmail = (s: string) => s.includes("@") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/** What was typed, tidied up: no spaces around it, no leading @, lowercase. */
export const normalizeUsername = (raw: string) => raw.trim().replace(/^@+/, "").toLowerCase();

/** A message to show if this is not an acceptable username, or null if it is. */
export function checkUsername(raw: string): string | null {
  const u = normalizeUsername(raw);
  if (u.length < USERNAME_MIN) return `Use at least ${USERNAME_MIN} characters.`;
  if (u.length > USERNAME_MAX) return `Use ${USERNAME_MAX} characters or fewer.`;
  if (!USERNAME_RE.test(u)) return "Use only letters, numbers and underscores.";
  if (RESERVED.includes(u)) return "That name is reserved. Pick another.";
  return null;
}

/** A username to start from, made out of the person's name, that is not taken. Falls back to adding digits. */
export function suggestUsername(name: string, isTaken: (u: string) => boolean = () => false): string {
  let base = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (base.length < USERNAME_MIN) base = (base + "student").slice(0, USERNAME_MIN + 3);
  base = base.slice(0, USERNAME_MAX - 3);
  if (!isTaken(base)) return base;
  for (let n = 1; n <= 99; n++) { const c = `${base}${n}`; if (!isTaken(c)) return c; }
  return `${base}${Math.floor(100 + Math.random() * 900)}`;
}

export type Found = { id: string; name: string; username: string };

/** The student on your campus with this username, or null. The rules in the database only show you your own campus. */
export async function findByUsername(raw: string): Promise<Found | null> {
  if (!supabase) return null;
  const u = normalizeUsername(raw);
  if (!USERNAME_RE.test(u)) return null;
  const { data, error } = await supabase.from("student_profiles").select("user_id,display_name,username").eq("username", u).maybeSingle();
  if (error || !data) return null;
  const r = data as { user_id: string; display_name: string; username: string };
  return { id: r.user_id, name: r.display_name, username: r.username };
}

/** Is this username free to take? Works before you have an account (the sign up form uses it). Resolves to null if it could not be checked. */
export async function usernameIsFree(raw: string): Promise<boolean | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("username_available", { candidate: normalizeUsername(raw) });
  return error ? null : data === true;
}

/** True if nobody on your campus (other than you) has this username. */
export async function isUsernameFree(raw: string, me: string): Promise<boolean> {
  const found = await findByUsername(raw);
  return !found || found.id === me;
}

/** Save your username. Resolves to a message to show if it did not work, or null on success. */
export async function saveUsername(userId: string, raw: string): Promise<string | null> {
  const bad = checkUsername(raw);
  if (bad) return bad;
  if (!supabase) return null;
  const username = normalizeUsername(raw);
  const { error } = await supabase.from("student_profiles").update({ username, updated_at: new Date().toISOString() }).eq("user_id", userId);
  if (!error) return null;
  if (error.code === "23505" || /duplicate|unique/i.test(error.message)) return "That username is taken. Try another.";
  if (/column|schema cache/i.test(error.message)) return "Usernames are not switched on for this project yet.";
  return "We could not save that. Check your connection and try again.";
}
