import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { demoAuth } from "./demoAuth";
import { loadProfile, saveProfile } from "./profile";
import { profileChanged, useProfileVersion } from "./nudges";
import { setHangName } from "./hangouts";
import { useAuth } from "./auth";

/** The name shown for the signed-in student everywhere: the one they chose (onboarding or Profile), then the account's name, then the start of their email. */
export function nameFor(session: Session | null): string {
  const u = session?.user;
  if (!u) return "Student";
  return loadProfile(u.id)?.name?.trim() || (u.user_metadata?.name as string | undefined) || u.email?.split("@")[0] || "Student";
}

/** The same, kept up to date: it changes on screen as soon as the student renames themselves. */
export function useDisplayName(): string {
  const { session } = useAuth();
  useProfileVersion();
  return nameFor(session);
}

export const NAME_MIN = 2;
export const NAME_MAX = 40;
export const cleanName = (raw: string) => raw.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);

/** Saves a new name on this device and, with a database, on the student's profile and account, so classmates see it too.
 *  Resolves to a message to show if it did not work, or null on success. */
export async function renameMe(session: Session | null, raw: string): Promise<string | null> {
  const u = session?.user;
  if (!u) return "Sign in first.";
  const name = cleanName(raw);
  if (name.length < NAME_MIN) return `Use at least ${NAME_MIN} characters.`;

  if (supabase) {
    const { error } = await supabase.from("student_profiles").update({ display_name: name, updated_at: new Date().toISOString() }).eq("user_id", u.id);
    if (error) return "We could not save that. Check your connection and try again.";
    await supabase.auth.updateUser({ data: { name } }).catch(() => undefined); // the profile above is what classmates see; this keeps the account in step
  } else {
    demoAuth.setName(u.id, name);
  }
  const p = loadProfile(u.id);
  if (p) saveProfile(u.id, { ...p, name });
  setHangName(name);
  profileChanged();
  return null;
}
