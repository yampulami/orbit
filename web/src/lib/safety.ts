import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { refreshEverything, watchTables } from "./people";

/** Blocking and reporting. Both need the database (in demo mode there are no other real students). */
export const safetyLive = !!supabase;

export const REASONS = [
  { id: "spam", label: "Spam" },
  { id: "harassment", label: "Harassment or bullying" },
  { id: "unsafe", label: "Unsafe or threatening" },
  { id: "misinformation", label: "Misleading" },
  { id: "other", label: "Something else" },
] as const;
export type Reason = (typeof REASONS)[number]["id"];

export type Blocked = { id: string; name: string; at: string };

let blocks: Blocked[] = [];
const subs = new Set<() => void>();
function set(next: Blocked[]) { blocks = next; subs.forEach((f) => f()); }

let who: string | null = null;
let stop: (() => void) | null = null;
let loadId = 0;

async function reload() {
  if (!who) return;
  const me = who, mine = ++loadId;
  type Row = { blocked_id: string; blocked_name?: string | null; created_at: string };
  let rows: Row[] | null = null;
  const withNames = await supabase!.from("user_blocks").select("blocked_id,blocked_name,created_at").order("created_at", { ascending: false }).limit(200);
  if (!withNames.error) rows = withNames.data as Row[];
  else {
    // The name column comes with the newest database change; until then the list still works, just without names.
    const plain = await supabase!.from("user_blocks").select("blocked_id,created_at").order("created_at", { ascending: false }).limit(200);
    if (!plain.error) rows = plain.data as Row[];
  }
  if (!rows || mine !== loadId || who !== me) return;
  set(rows.map((r) => ({ id: r.blocked_id, name: r.blocked_name?.trim() || "Someone", at: r.created_at })));
}

export function bindBlocks(userId: string) {
  if (!safetyLive || who === userId) return;
  unbindBlocks();
  who = userId;
  void reload();
  stop = watchTables(`orbit-blocks-${userId}`, ["user_blocks"], () => void reload());
}
export function unbindBlocks() {
  if (!safetyLive) return;
  stop?.(); stop = null;
  who = null; loadId++;
  set([]);
}

const missingColumn = (message: string) => /column|schema cache/i.test(message);

const friendly = (message: string) =>
  /function|schema cache|could not find|column/i.test(message) ? "This is not switched on for this project yet." : message || "That did not work. Try again.";

export const safetyActions = {
  /** Block someone. Their posts, comments, messages and plans disappear for you, and yours for them, and you stop being friends. */
  async block(userId: string, name: string): Promise<string | null> {
    if (!supabase || !who) return "Sign in first.";
    let { error } = await supabase.from("user_blocks").insert({ blocker_id: who, blocked_id: userId, blocked_name: name.slice(0, 100) });
    // Before the newest database change is applied there is no column for the name: block anyway (the list then says "Someone").
    if (error && missingColumn(error.message)) ({ error } = await supabase.from("user_blocks").insert({ blocker_id: who, blocked_id: userId }));
    if (error && error.code !== "23505") return friendly(error.message);
    await reload();
    refreshEverything(); // every screen looks again, so they vanish from what is on screen
    return null;
  },
  async unblock(userId: string): Promise<string | null> {
    if (!supabase || !who) return "Sign in first.";
    const { error } = await supabase.from("user_blocks").delete().eq("blocked_id", userId);
    if (error) return friendly(error.message);
    await reload();
    refreshEverything();
    return null;
  },
  /** Send a report to whoever looks after Orbit. It points at a person, and optionally at a post or a comment. */
  async report(o: { userId: string; postId?: string; commentId?: string; reason: Reason; detail?: string; context?: string }): Promise<string | null> {
    if (!supabase || !who) return "Sign in first.";
    const base = { reporter_id: who, reported_user_id: o.userId, post_id: o.postId ?? null, reason: o.reason, detail: (o.detail ?? "").trim().slice(0, 500) };
    let { error } = await supabase.from("content_reports").insert({ ...base, comment_id: o.commentId ?? null, context: o.context ?? null });
    // Before the newest database change is applied there are no columns for the comment or the place. The report must still go through,
    // so say where it happened in the written part instead.
    if (error && missingColumn(error.message)) {
      const where = [o.context, o.commentId ? `comment ${o.commentId}` : ""].filter(Boolean).join(", ");
      ({ error } = await supabase.from("content_reports").insert({ ...base, detail: (where ? `[${where}] ` : "") + base.detail }));
    }
    return error ? friendly(error.message) : null;
  },
};

export const useBlocks = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => blocks);
