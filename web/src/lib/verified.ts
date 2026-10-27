import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { useCampusEvents } from "./campusEvents";

/** Who gets the verified check: people with administrative powers on campus (coordinators and staff hosts). Clubs get it from being approved by a coordinator. */
let ids = new Set<string>();
let loadedAt = 0;
const subs = new Set<() => void>();
const REFRESH_MS = 5 * 60_000;

async function load() {
  if (!supabase || Date.now() - loadedAt < REFRESH_MS) return;
  loadedAt = Date.now();
  const { data, error } = await supabase.from("campus_hosts").select("user_id").in("role", ["coordinator", "staff"]).limit(500);
  if (error) { loadedAt = 0; return; }
  ids = new Set((data ?? []).map((r: { user_id: string }) => r.user_id));
  subs.forEach((f) => f());
}

export function clearVerified() { ids = new Set(); loadedAt = 0; subs.forEach((f) => f()); }

/** Returns a checker: is this person verified (an administrator on their campus)? */
export function useVerified(): (userId: string | null | undefined) => boolean {
  const set = useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => ids);
  const { role } = useCampusEvents();
  useEffect(() => { void load(); }, []);
  return (id) => !!id && (set.has(id) || (!supabase && (id === "demo-staff" || (id === "demo-me" && role !== "student"))));
}
