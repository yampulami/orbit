import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { blocksFromClasses, type Block, type Person } from "./freeTime";
import type { ClassSlot } from "./classes";

/** Whether the student lets friends see when they are busy, and what friends have shared. Needs the database; without it nothing is shared. */
export type Audience = { audience: "friends" | "selected"; allowed: string[]; housemates: boolean; clubCounts: boolean };
const DEFAULT_AUDIENCE: Audience = { audience: "friends", allowed: [], housemates: true, clubCounts: false };
type State = { ready: boolean; on: boolean; missing: boolean; who: Audience };
let state: State = { ready: false, on: false, missing: false, who: DEFAULT_AUDIENCE };
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
    if (error) { set({ ready: true, on: false, missing: true, who: DEFAULT_AUDIENCE }); return; }
    const on = !!(data as { enabled: boolean } | null)?.enabled;
    // The audience settings arrive with a later migration; without it everything stays "all friends".
    let who = DEFAULT_AUDIENCE;
    const a = await supabase!.rpc("my_free_time_audience");
    const row = (a.data as { audience: string; housemates: boolean; club_counts: boolean; allowed: string[] }[] | null)?.[0];
    if (!a.error && row) who = { audience: row.audience === "selected" ? "selected" : "friends", allowed: row.allowed ?? [], housemates: row.housemates, clubCounts: row.club_counts };
    set({ ready: true, on, missing: false, who });
  })();
}
export function unbindSharing() { who = null; set({ ready: false, on: false, missing: false, who: DEFAULT_AUDIENCE }); }

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
    set({ ...state, on, missing: false, ...(on ? {} : { who: DEFAULT_AUDIENCE }) });
    if (on) return pushBusy(classes);
    return null;
  },
  /** Who may see your free time: all friends or chosen ones, housemates, and whether clubs may count you (numbers only). */
  async setAudience(next: Audience): Promise<string | null> {
    if (!supabase || !state.on) return "Turn on sharing first.";
    const before = state.who;
    set({ ...state, who: next });
    const { error } = await supabase.rpc("set_free_time_audience", { aud: next.audience, allowed: next.allowed, housemates_: next.housemates, club_: next.clubCounts });
    if (error) { set({ ...state, who: before }); return /function|does not exist|schema cache/i.test(error.message) ? "These settings are not available yet." : error.message; }
    return null;
  },
};

/** The members of a group or household, with names, so their free time can be looked up (only people who share it with you will have any). */
export async function loadGroupPeople(groupId: string, me: string): Promise<{ id: string; name: string }[]> {
  if (!supabase) return [];
  const m = await supabase.from("campus_group_memberships").select("user_id").eq("group_id", groupId);
  const ids = ((m.data ?? []) as { user_id: string }[]).map((r) => r.user_id).filter((id) => id !== me);
  if (ids.length === 0) return [];
  const p = await supabase.from("student_profiles").select("user_id,display_name").in("user_id", ids);
  const names = new Map(((p.data ?? []) as { user_id: string; display_name: string }[]).map((r) => [r.user_id, r.display_name]));
  return ids.map((id) => ({ id, name: names.get(id) ?? "Student" }));
}

/** How many of a club's members are free in each half hour of each weekday, as numbers only. Empty until at least 5 members have agreed to be counted. Officers only. */
export type ClubCount = { weekday: number; slot: number; free: number; total: number };
export async function clubFreeCounts(orgId: string): Promise<{ counts: ClubCount[]; agreed: number; error?: string }> {
  if (!supabase) return { counts: [], agreed: 0 };
  const [c, n] = await Promise.all([supabase.rpc("club_free_counts", { org: orgId }), supabase.rpc("club_sharing_count", { org: orgId })]);
  if (c.error) return { counts: [], agreed: 0, error: /function|does not exist|schema cache/i.test(c.error.message) ? "Not available yet." : c.error.message };
  return { counts: ((c.data ?? []) as ClubCount[]), agreed: Number(n.data ?? 0) };
}

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
