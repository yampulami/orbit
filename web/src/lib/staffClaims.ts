import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

/** Proving you run student life at your school, and (for coordinators) managing who has staff access. The checking itself happens on the server
 *  (verify-staff-claim): the app only sends the address of the page and shows what came back. */
export type VerifyResult = { ok: boolean; role?: string; title?: string; code?: string; reason?: string; already?: boolean };

const PERSONAL = new Set(["gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "pm.me", "gmx.com", "mail.com"]);
/** Is this a personal address (so it cannot prove a school role)? */
export const isPersonalEmail = (email: string) => PERSONAL.has((email.split("@")[1] ?? "").toLowerCase());

/** Send the page address; the server reads the page and decides. */
export async function verifyStaff(url: string): Promise<VerifyResult> {
  if (!supabase) return { ok: false, code: "demo", reason: "Verifying a staff role needs the live app." };
  const { data, error } = await supabase.functions.invoke("verify-staff-claim", { body: { url } });
  if (error) {
    let reason = error.message;
    try { const ctx = (error as { context?: Response }).context; const b = ctx ? await ctx.json() as VerifyResult : null; if (b?.reason) return b; } catch { /* use the generic message */ }
    return { ok: false, code: "error", reason: /not found|404|Failed to send/i.test(reason) ? "Verification is not switched on yet." : reason };
  }
  return (data ?? { ok: false, reason: "No answer came back." }) as VerifyResult;
}

/** When the page did not prove it, ask the campus's coordinators to decide. Resolves to a message if it did not work, or null. */
export async function requestStaffReview(url: string, title: string): Promise<string | null> {
  if (!supabase) return "Needs the live app.";
  const { error } = await supabase.rpc("request_staff_review", { page_url: url, title });
  return error ? error.message : null;
}

export type TeamMember = { id: string; role: "coordinator" | "staff" | "student"; label: string; source: "manual" | "directory" | "claim" };
export type Claim = { id: string; userId: string; email: string; url: string; title: string; at: string };

/** The campus's staff team and the requests waiting for a coordinator (coordinators only; for everyone else the lists come back empty). */
export function useStaffTeam(enabled: boolean) {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!supabase || !enabled) return;
    const [h, c] = await Promise.all([
      supabase.from("campus_hosts").select("user_id,label,role,source").order("role", { ascending: true }),
      supabase.from("staff_claims").select("id,user_id,email,page_url,claimed_title,created_at").eq("status", "pending").order("created_at", { ascending: true }),
    ]);
    if (!h.error) setTeam(((h.data ?? []) as { user_id: string; label: string; role: TeamMember["role"]; source?: TeamMember["source"] }[]).map((r) => ({ id: r.user_id, role: r.role, label: r.label, source: r.source ?? "manual" })));
    // Before the claims update reaches the database the table is missing: the team still shows.
    if (!c.error) setClaims(((c.data ?? []) as { id: string; user_id: string; email: string; page_url: string; claimed_title: string; created_at: string }[]).map((r) => ({ id: r.id, userId: r.user_id, email: r.email, url: r.page_url, title: r.claimed_title, at: r.created_at })));
  }, [enabled]);
  useEffect(() => { void reload(); }, [reload]);

  return {
    team, claims, error,
    async remove(id: string): Promise<string | null> {
      const { error: e } = await supabase!.rpc("remove_staff_access", { target: id });
      if (e) { setError(e.message); return e.message; }
      setError(""); await reload(); return null;
    },
    async decide(claim: string, approve: boolean, role: "staff" | "coordinator" = "staff"): Promise<string | null> {
      const { error: e } = await supabase!.rpc("decide_staff_claim", { claim, approve, as_role: role });
      if (e) { setError(e.message); return e.message; }
      setError(""); await reload(); return null;
    },
  };
}
