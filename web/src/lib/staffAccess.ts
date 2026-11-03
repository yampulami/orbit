import { supabase } from "./supabase";

/** After sign-in: if the school's staff directory lists this person's verified email, the database gives them their coordinator or staff role (and
 *  their title as the label on their events). Resolves to the role they now hold, or null. Quiet when it does not apply, or before the setup is done. */
export async function claimStaffAccess(): Promise<"coordinator" | "staff" | "student" | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc("claim_staff_access");
    if (error) return null;
    return data === "coordinator" || data === "staff" || data === "student" ? data : null;
  } catch { return null; }
}
