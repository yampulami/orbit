import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { blocksFromClasses, type Block, type Person } from "./freeTime";
import type { ClassSlot } from "./classes";

/** Whether the student lets friends see when they are busy, and what friends have shared. Needs the database; without it nothing is shared. */
type State = { ready: boolean; on: boolean; missing: boolean };
let state: State = { ready: false, on: false, missing: false };
const subs = new Set<() => void>();
function set(next: State) { state = next; subs.forEach((f) => f()); }
export const useSharing = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);

let who: string | null = null;
export function bindSharing(userId: string) {
  if (!supabase || who === userId) return;
  who = userId;
  void (async () => {
    const { data, error } = await supabase!.from("availability_sharing").select("enabled").eq("user_id", userId).maybeSingle();
    // Before the database has the table, sharing is simply unavailable.
    if (error) { set({ ready: true, on: false, missing: true }); return; }
    set({ ready: true, on: !!(data as { enabled: boolean } | null)?.enabled, missing: false });
  })();
}
export function unbindSharing() { who = null; set({ ready: false, on: false, missing: false }); }

const toRows = (blocks: Block[]) => blocks.map((b) => ({ d: b.d, s: b.s, e: b.e }));

/** Send the student's own busy blocks (from their classes, no names) to the database. Only does anything while sharing is on. */
export async function pushBusy(classes: ClassSlot[]): Promise<string | null> {
  if (!supabase || !state.on) return null;
  const { error } = await supabase.rpc("set_busy_blocks", { blocks: toRows(blocksFromClasses(classes)) });
  return error ? error.message : null;
}

export const availabilityActions = {
  async setSharing(on: boolean, classes: ClassSlot[]): Promise<string | null> {
    if (!supabase) return "Sharing needs an account.";
    const { error } = await supabase.rpc("set_free_time_sharing", { on_: on });
    if (error) return error.message;
    set({ ...state, on, missing: false });
    if (on) return pushBusy(classes);
    return null;
  },
};

/** The friends who are sharing, with their busy blocks, and the ones who are not. */
export async function loadFriendFree(friends: { id: string; name: string }[]): Promise<{ sharing: Person[]; notSharing: string[] }> {
  if (!supabase || friends.length === 0) return { sharing: [], notSharing: friends.map((f) => f.name) };
  const ids = friends.map((f) => f.id);
  const s = await supabase.rpc("free_time_sharers", { ids });
  if (s.error) return { sharing: [], notSharing: friends.map((f) => f.name) };
  const sharers = new Set((s.data as string[] | null) ?? []);
  let rows: { user_id: string; weekday: number; start_min: number; end_min: number }[] = [];
  if (sharers.size) {
    const b = await supabase.from("busy_blocks").select("user_id,weekday,start_min,end_min").in("user_id", [...sharers]).limit(2000);
    rows = (b.data ?? []) as typeof rows;
  }
  return {
    sharing: friends.filter((f) => sharers.has(f.id)).map((f) => ({ id: f.id, name: f.name, blocks: rows.filter((r) => r.user_id === f.id).map((r) => ({ d: r.weekday, s: r.start_min, e: r.end_min })) })),
    notSharing: friends.filter((f) => !sharers.has(f.id)).map((f) => f.name),
  };
}
