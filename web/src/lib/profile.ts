import { supabase } from "./supabase";

/** What a student told us during onboarding. Saved on this device, per account, until a profiles table exists on the server.
 *  The university itself is also saved as the account's campus membership, which is what separates the feed by university. */
export type Tenure = "first-semester" | "first-year" | "second-year" | "third-year" | "fourth-plus" | "graduate";
export type Living = "residence" | "commute" | "off-campus" | "other";
export type Look = "light" | "dark" | "system";

export type Profile = {
  name: string;
  campusName: string;
  campusKey: string;
  campusDomain?: string;
  tenure: Tenure;
  living: Living;
  interests: string[];
  streaks: boolean;
  nudges: { hangouts: boolean; reminders: boolean; places: boolean };
  look: Look;
  doneAt: string;
};

const key = (userId: string) => `orbit-profile-v1:${userId}`;

export function loadProfile(userId: string): Profile | null {
  try { const s = localStorage.getItem(key(userId)); return s ? (JSON.parse(s) as Profile) : null; } catch { return null; }
}
export function saveProfile(userId: string, p: Profile) {
  try { localStorage.setItem(key(userId), JSON.stringify(p)); } catch { /* ignore */ }
}

/** How many years the person has been on campus, 1 to 6, for the orbit rings and for weighting map votes later. */
export const TENURE_YEARS: Record<Tenure, number> = { "first-semester": 1, "first-year": 2, "second-year": 3, "third-year": 4, "fourth-plus": 5, graduate: 6 };

/* ---------- the database copy (student_profiles). Without Supabase these do nothing and the device copy above is all there is. ---------- */

/** Saves the onboarding answers on the student's profile row. The campus membership has to exist first, because the row is tied to the campus. */
export async function pushProfile(userId: string, p: Profile): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("student_profiles").upsert({
    user_id: userId, campus_key: p.campusKey, display_name: p.name,
    tenure: p.tenure, living: p.living, interests: p.interests, streaks_enabled: p.streaks, nudges: p.nudges, theme_pref: p.look,
    onboarded_at: p.doneAt, updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

/** The saved answers for this student, or null if they have none (or there is no database). */
export async function pullProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const [prof, member] = await Promise.all([
    supabase.from("student_profiles").select("display_name,campus_key,tenure,living,interests,streaks_enabled,nudges,theme_pref,onboarded_at").eq("user_id", userId).maybeSingle(),
    supabase.from("campus_memberships").select("campus_key,campus_name").eq("user_id", userId).maybeSingle(),
  ]);
  const r = prof.data, m = member.data;
  if (!r || !m || !r.tenure || !r.living) return null;
  return {
    name: r.display_name, campusName: m.campus_name, campusKey: m.campus_key, tenure: r.tenure as Tenure, living: r.living as Living,
    interests: r.interests ?? [], streaks: !!r.streaks_enabled,
    nudges: { hangouts: true, reminders: true, places: true, ...(r.nudges ?? {}) },
    look: (r.theme_pref ?? "system") as Look, doneAt: r.onboarded_at ?? new Date().toISOString(),
  };
}

/** Makes sure this student has a profile row, because that row is where classmates get their name from. Accounts made before profiles were kept in
 *  the database have none, and everyone else then sees them as "Student". Uses the answers saved on this device if there are any, otherwise just a name. */
export async function ensureProfileRow(userId: string, fallbackName: string): Promise<void> {
  if (!supabase) return;
  const have = await supabase.from("student_profiles").select("user_id").eq("user_id", userId).maybeSingle();
  if (have.error || have.data) return;
  const local = loadProfile(userId);
  if (local) { await pushProfile(userId, local); return; }
  const member = await supabase.from("campus_memberships").select("campus_key").eq("user_id", userId).maybeSingle();
  if (member.error || !member.data) return; // not on a campus yet: onboarding will make the row
  const name = fallbackName.replace(/\s+/g, " ").trim().slice(0, 100) || "Student";
  await supabase.from("student_profiles").insert({ user_id: userId, campus_key: (member.data as { campus_key: string }).campus_key, display_name: name });
}

/** Saves only the nudge choices, for when they change in Profile. */
export async function pushNudges(userId: string, nudges: Profile["nudges"]): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("student_profiles").update({ nudges, updated_at: new Date().toISOString() }).eq("user_id", userId);
  if (error) throw new Error(error.message);
}
