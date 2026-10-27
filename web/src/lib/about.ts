import { supabase } from "./supabase";

/** "About me": a short bio and what the person does in their free time. It shows on their profile to everyone on their campus.
 *  The bio is limited to 240 characters (what the database allows): long enough for a few lines, short enough to read at a glance. Emoji count as one. */
export const BIO_MAX = 240;
export const HOBBY_MAX = 8;
export const HOBBY_LEN = 24;
export type About = { bio: string; hobbies: string[] };

export const HOBBY_IDEAS = ["Gaming", "Gym", "Reading", "Music", "Coffee runs", "Hiking", "Cooking", "Art", "Soccer", "Basketball", "Movies", "Photography", "Dancing", "Anime", "Board games", "Running"];

const chars = (s: string) => Array.from(s);
export const bioLength = (s: string) => chars(s).length;

/** The bio as it is saved: edges trimmed, long runs of blank lines squeezed, cut to the limit. */
export const cleanBio = (s: string) => chars(s.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()).slice(0, BIO_MAX).join("").trim();

/** Free-time tags as saved: spaces tidied, no empties or repeats (ignoring capitals), each short, and not too many. */
export function cleanHobbies(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const t = chars(raw.replace(/\s+/g, " ").trim()).slice(0, HOBBY_LEN).join("").trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase()); out.push(t);
    if (out.length >= HOBBY_MAX) break;
  }
  return out;
}

/** "Gaming, hiking\nbaking" to tags. */
export const parseHobbies = (text: string) => cleanHobbies(text.split(/[,\n]/));

const key = (userId: string) => `orbit-about-v1:${userId}`;

/** The saved bio and free-time tags: from the database when there is one, otherwise from this device. */
export async function loadAbout(userId: string): Promise<About> {
  if (supabase) {
    const { data } = await supabase.from("student_profiles").select("bio,hobbies").eq("user_id", userId).maybeSingle();
    const r = data as { bio: string | null; hobbies: string[] | null } | null;
    return { bio: r?.bio ?? "", hobbies: r?.hobbies ?? [] };
  }
  try { const s = localStorage.getItem(key(userId)); if (s) { const a = JSON.parse(s) as About; return { bio: a.bio ?? "", hobbies: a.hobbies ?? [] }; } } catch { /* nothing saved */ }
  return { bio: "", hobbies: [] };
}

/** Save them. Resolves to a message if it did not work, or null. */
export async function saveAbout(userId: string, about: About): Promise<string | null> {
  const clean = { bio: cleanBio(about.bio), hobbies: cleanHobbies(about.hobbies) };
  if (supabase) {
    const { error } = await supabase.from("student_profiles").update({ ...clean, updated_at: new Date().toISOString() }).eq("user_id", userId);
    return error ? (/check|violates/i.test(error.message) ? "That is a little too long. Shorten it and try again." : error.message) : null;
  }
  try { localStorage.setItem(key(userId), JSON.stringify(clean)); } catch { return "Could not save on this device."; }
  return null;
}
