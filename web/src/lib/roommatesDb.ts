import { supabase } from "./supabase";
import type { Expense, Grocery, Note, Points, Space, Task } from "./roommates";
import { loadNames, makeLabeler, watchTables } from "./people";

/** A household in the database. The rows become the same `Space` the roommate screens already use (people shown by display name, "You" for the
 *  signed-in student); `ids` remembers which name is which person so changes can be saved against the right user. */
export type RawTask = { id: string; title: string; assignee: string | null; points: number; done: boolean; done_at: string | null; due_on: string | null; created_at: string };
export type RawGrocery = { id: string; name: string; category: string; bought: boolean };
export type RawExpense = { id: string; item: string; cents: number; paid_by: string | null; split: string[]; created_at: string };
export type RawNote = { id: string; title: string; body: string };
export type RawHousehold = {
  me: string;
  groupId: string; name: string;
  members: string[];
  tasks: RawTask[]; groceries: RawGrocery[]; expenses: RawExpense[]; notes: RawNote[];
  names: Record<string, string>;
};

const POINTS = new Set([1, 2, 3, 5]);

/** Pure: rows in, screen state out. `ids` maps each shown name back to its user id. */
export function buildSpace(raw: RawHousehold): { space: Space; ids: Record<string, string> } {
  const everyone = [...raw.members, ...raw.tasks.map((t) => t.assignee), ...raw.expenses.map((e) => e.paid_by), ...raw.expenses.flatMap((e) => e.split)].filter((x): x is string => !!x);
  const label = makeLabeler(raw.me, everyone, raw.names);
  const ids: Record<string, string> = {};
  for (const id of new Set(everyone)) ids[label(id)] = id;
  const you = label(raw.me);
  const nameOf = (id: string | null) => (id ? label(id) : "Someone");

  // You first, then the others in alphabetical order, so the order is the same for everybody on every load.
  const members = [...new Set(raw.members)].sort((a, b) => (a === raw.me ? -1 : b === raw.me ? 1 : label(a).localeCompare(label(b)))).map(label);

  const tasks: Task[] = raw.tasks.map((t) => ({
    id: t.id, title: t.title, assignee: nameOf(t.assignee), points: (POINTS.has(t.points) ? t.points : 2) as Points, done: t.done,
    createdAt: t.created_at, doneAt: t.done_at ?? undefined, due: t.due_on ?? undefined,
  }));
  const groceries: Grocery[] = raw.groceries.map((g) => ({ id: g.id, name: g.name, category: g.category, bought: g.bought }));
  const expenses: Expense[] = raw.expenses.map((e) => ({ id: e.id, item: e.item, cents: e.cents, paidBy: nameOf(e.paid_by), split: e.split.map(label), at: e.created_at }));
  const notes: Note[] = raw.notes.map((n) => ({ id: n.id, title: n.title, body: n.body }));
  return { space: { name: raw.name, members, groupId: raw.groupId, tasks, groceries, expenses, notes }, ids: { ...ids, [you]: raw.me } };
}

/** Your household (the oldest one you are in), or null if you are not in one yet. */
export async function loadHousehold(me: string): Promise<RawHousehold | null> {
  const sb = supabase!;
  const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };

  const hh = await sb.from("households").select("group_id,created_at").order("created_at", { ascending: true }).limit(1);
  fail(hh.error);
  const first = (hh.data ?? [])[0] as { group_id: string } | undefined;
  if (!first) return null;
  const gid = first.group_id;

  const [group, mem, tasks, groceries, expenses, notes] = await Promise.all([
    sb.from("campus_groups").select("id,name").eq("id", gid).limit(1),
    sb.from("campus_group_memberships").select("user_id").eq("group_id", gid),
    sb.from("household_tasks").select("id,title,assignee,points,done,done_at,due_on,created_at").eq("group_id", gid).order("created_at", { ascending: false }).limit(500),
    sb.from("household_groceries").select("id,name,category,bought").eq("group_id", gid).order("created_at", { ascending: true }).limit(500),
    sb.from("household_expenses").select("id,item,cents,paid_by,split,created_at").eq("group_id", gid).order("created_at", { ascending: false }).limit(500),
    sb.from("household_notes").select("id,title,body").eq("group_id", gid).order("created_at", { ascending: false }).limit(200),
  ]);
  [group, mem, tasks, groceries, expenses, notes].forEach((r) => fail(r.error));
  const g = (group.data ?? [])[0] as { id: string; name: string } | undefined;
  if (!g) return null;

  const members = ((mem.data ?? []) as { user_id: string }[]).map((m) => m.user_id);
  const t = (tasks.data ?? []) as RawTask[], e = (expenses.data ?? []) as RawExpense[];
  const names = await loadNames([...members, ...t.map((x) => x.assignee), ...e.map((x) => x.paid_by), ...e.flatMap((x) => x.split)].filter((x): x is string => !!x));
  return { me, groupId: g.id, name: g.name, members, tasks: t, groceries: (groceries.data ?? []) as RawGrocery[], expenses: e, notes: (notes.data ?? []) as RawNote[], names };
}

export const watchHousehold = (me: string, onChange: () => void) =>
  watchTables(`orbit-household-${me}`, ["households", "household_tasks", "household_groceries", "household_expenses", "household_notes", "campus_group_memberships"], onChange);
