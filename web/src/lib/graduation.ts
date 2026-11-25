import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "./supabase";

export type GradStatus = "expected" | "claimed" | "verified" | "declined";
export type Graduation = { month: number; year: number; status: GradStatus; proof: string; note: string; snoozeUntil: string | null };

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const gradLabel = (g: Pick<Graduation, "month" | "year">) => `${MONTHS[g.month - 1]} ${g.year}`;
const index = (year: number, month: number) => year * 12 + (month - 1);
/** True once the named month has arrived: that is when the graduate can confirm it. */
export const isDue = (g: Pick<Graduation, "month" | "year">, now = new Date()) => index(g.year, g.month) <= index(now.getFullYear(), now.getMonth() + 1);
/** How many months until graduation (0 or less once it has arrived). */
export const monthsAway = (g: Pick<Graduation, "month" | "year">, now = new Date()) => index(g.year, g.month) - index(now.getFullYear(), now.getMonth() + 1);

type Row = { grad_month: number; grad_year: number; status: GradStatus; proof: string; note: string; snooze_until: string | null };
const CHANGED = "orbit-graduation";
const announce = () => { window.dispatchEvent(new CustomEvent(CHANGED)); void loadAlumni(true); };

async function rpc(name: string, args?: Record<string, unknown>): Promise<string | null> {
  if (!supabase) return "This needs an account on the server.";
  const { error } = await supabase.rpc(name, args);
  if (error) return error.message || "That did not work. Try again.";
  announce();
  return null;
}

/** Your own graduation record. `undefined` while loading, `null` if you have not said when you graduate. */
export function useGraduation(me: string | undefined) {
  const [grad, setGrad] = useState<Graduation | null | undefined>(undefined);
  const reload = useCallback(async () => {
    if (!supabase || !me) { setGrad(null); return; }
    const { data, error } = await supabase.from("graduations").select("grad_month,grad_year,status,proof,note,snooze_until").eq("user_id", me).maybeSingle();
    if (error) { setGrad(undefined); return; } // not known: show nothing rather than ask again
    const r = data as Row | null;
    setGrad(r ? { month: r.grad_month, year: r.grad_year, status: r.status, proof: r.proof, note: r.note, snoozeUntil: r.snooze_until } : null);
  }, [me]);
  useEffect(() => {
    void reload();
    const again = () => void reload();
    window.addEventListener(CHANGED, again);
    return () => window.removeEventListener(CHANGED, again);
  }, [reload]);
  return {
    grad,
    setDate: (month: number, year: number) => rpc("set_graduation", { month_in: month, year_in: year }),
    claim: (proof: string) => rpc("claim_graduation", { proof_in: proof }),
    snooze: () => rpc("snooze_graduation"),
  };
}

// ---- the badge: who on this campus is a verified graduate (loaded once, shared by every name on screen) ----
let alumni = new Map<string, number>(supabase ? [] : [["demo-a1", 2024], ["demo-a2", 2023], ["demo-a3", 2022]]);
const subs = new Set<() => void>();
let loadedFor: "no" | "yes" | "loading" = supabase ? "no" : "yes";

async function loadAlumni(force = false) {
  if (!supabase || loadedFor === "loading" || (loadedFor === "yes" && !force)) return;
  loadedFor = "loading";
  const { data, error } = await supabase.rpc("campus_alumni");
  loadedFor = error ? "no" : "yes";
  if (error) return;
  alumni = new Map(((data ?? []) as { user_id: string; grad_year: number }[]).map((r) => [r.user_id, r.grad_year]));
  subs.forEach((f) => f());
}
supabase?.auth.onAuthStateChange((e) => { if (e === "SIGNED_IN" || e === "SIGNED_OUT") { loadedFor = "no"; alumni = new Map(); subs.forEach((f) => f()); } });

/** Every verified graduate on this campus: id to class year. */
export function useAlumniYears(): Map<string, number> {
  const map = useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => alumni);
  useEffect(() => { void loadAlumni(); }, [map]);
  return map;
}

/** The class year if this person is a verified graduate, otherwise undefined. */
export function useAlumYear(id: string | undefined): number | undefined {
  const map = useAlumniYears();
  return id ? map.get(id) : undefined;
}

// ---- coordinators: graduates waiting to be checked ----
export type GradClaim = { id: string; name: string; month: number; year: number; proof: string };

export function useGradClaims(reviewer: boolean, me: string | undefined) {
  const [claims, setClaims] = useState<GradClaim[]>([]);
  const reload = useCallback(async () => {
    if (!supabase || !reviewer) { setClaims([]); return; }
    const { data } = await supabase.from("graduations").select("user_id,grad_month,grad_year,proof").eq("status", "claimed").order("claimed_at", { ascending: true }).limit(100);
    const rows = ((data ?? []) as { user_id: string; grad_month: number; grad_year: number; proof: string }[]).filter((r) => r.user_id !== me);
    const names = new Map<string, string>();
    if (rows.length) {
      const n = await supabase.from("student_profiles").select("user_id,display_name").in("user_id", rows.map((r) => r.user_id));
      for (const p of (n.data ?? []) as { user_id: string; display_name: string }[]) names.set(p.user_id, p.display_name);
    }
    setClaims(rows.map((r) => ({ id: r.user_id, name: names.get(r.user_id) ?? "A student", month: r.grad_month, year: r.grad_year, proof: r.proof })));
  }, [reviewer, me]);
  useEffect(() => {
    void reload();
    const again = () => void reload();
    window.addEventListener(CHANGED, again);
    return () => window.removeEventListener(CHANGED, again);
  }, [reload]);
  return { claims, review: (target: string, approve: boolean, note = "") => rpc("review_graduation", { target, approve, note_in: note }) };
}
