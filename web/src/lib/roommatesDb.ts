import { supabase } from "./supabase";
import type { Expense, Grocery, Kind, Note, Payment, Points, Space, Task } from "./roommates";
import { loadNames, makeLabeler, watchTables, type ChangeEvent } from "./people";

/** A household in the database. The rows become the same `Space` the roommate screens already use (people shown by display name, "You" for the
 *  signed-in student); `ids` remembers which name is which person so changes can be saved against the right user. */
export type RawTask = { id: string; title: string; assignee: string | null; points: number; done: boolean; done_at: string | null; due_on: string | null; created_at: string };
export type RawGrocery = { id: string; name: string; category: string; bought: boolean };
export type RawExpense = { id: string; item: string; cents: number; paid_by: string | null; split: string[]; created_at: string };
export type RawNote = { id: string; title: string; body: string };
export type RawPayment = { id: string; from_user: string | null; to_user: string | null; cents: number; created_at: string };
export type RawHousehold = {
  me: string;
  groupId: string; name: string;
  members: string[];
  tasks: RawTask[]; groceries: RawGrocery[]; expenses: RawExpense[]; notes: RawNote[]; payments: RawPayment[];
  names: Record<string, string>;
};

const POINTS = new Set([1, 2, 3, 5]);

const taskOf = (t: RawTask, nameOf: (id: string | null) => string): Task => ({
  id: t.id, title: t.title, assignee: nameOf(t.assignee), points: (POINTS.has(t.points) ? t.points : 2) as Points, done: t.done,
  createdAt: t.created_at, doneAt: t.done_at ?? undefined, due: t.due_on ?? undefined,
});
const groceryOf = (g: RawGrocery): Grocery => ({ id: g.id, name: g.name, category: g.category, bought: g.bought });
const expenseOf = (e: RawExpense, nameOf: (id: string | null) => string, label: (id: string) => string): Expense => ({ id: e.id, item: e.item, cents: e.cents, paidBy: nameOf(e.paid_by), split: e.split.map(label), at: e.created_at });
const noteOf = (n: RawNote): Note => ({ id: n.id, title: n.title, body: n.body });
const paymentOf = (p: RawPayment, nameOf: (id: string | null) => string): Payment => ({ id: p.id, from: nameOf(p.from_user), to: nameOf(p.to_user), cents: p.cents, at: p.created_at });

const KIND_OF: Record<string, Kind> = { household_tasks: "tasks", household_groceries: "groceries", household_expenses: "expenses", household_notes: "notes", household_payments: "payments" };

/** Pure: one change from the database applied to what is on screen. `nameOf` gives the name shown for a user id, or undefined if that person is not known yet.
 *  Returns the new screen state, or null when the change cannot be applied on its own (an unknown person, or not a chore/item/expense/note/payment),
 *  in which case the caller looks everything up again. */
export function applyChange(space: Space, nameOf: (id: string) => string | undefined, e: ChangeEvent): Space | null {
  const kind = KIND_OF[e.table];
  if (!kind) return null;
  const list = space[kind] as { id: string }[];
  if (e.type === "DELETE") {
    const id = e.old.id as string | undefined;
    return id ? { ...space, [kind]: list.filter((x) => x.id !== id) } : null;
  }
  const r = e.row as Record<string, unknown>;
  if (r.group_id !== space.groupId) return space; // some other household
  let unknown = false;
  const known = (id: string | null) => { if (!id) return "Someone"; const n = nameOf(id); if (n === undefined) unknown = true; return n ?? "Someone"; };
  const label = (id: string) => known(id);
  let item: { id: string };
  if (kind === "tasks") item = taskOf(r as unknown as RawTask, known);
  else if (kind === "groceries") item = groceryOf(r as unknown as RawGrocery);
  else if (kind === "expenses") item = expenseOf(r as unknown as RawExpense, known, label);
  else if (kind === "notes") item = noteOf(r as unknown as RawNote);
  else item = paymentOf(r as unknown as RawPayment, known);
  if (unknown) return null;
  const at = list.findIndex((x) => x.id === item.id);
  const next = [...list];
  if (at >= 0) next[at] = item;
  else if (kind === "groceries") next.push(item);   // the shopping list reads oldest first
  else next.unshift(item);                          // the rest read newest first
  return { ...space, [kind]: next };
}

/** Pure: rows in, screen state out. `ids` maps each shown name back to its user id. */
export function buildSpace(raw: RawHousehold): { space: Space; ids: Record<string, string> } {
  const everyone = [...raw.members, ...raw.tasks.map((t) => t.assignee), ...raw.expenses.map((e) => e.paid_by), ...raw.expenses.flatMap((e) => e.split), ...raw.payments.flatMap((p) => [p.from_user, p.to_user])].filter((x): x is string => !!x);
  const label = makeLabeler(raw.me, everyone, raw.names);
  const ids: Record<string, string> = {};
  for (const id of new Set(everyone)) ids[label(id)] = id;
  const you = label(raw.me);
  const nameOf = (id: string | null) => (id ? label(id) : "Someone");

  // You first, then the others in alphabetical order, so the order is the same for everybody on every load.
  const members = [...new Set(raw.members)].sort((a, b) => (a === raw.me ? -1 : b === raw.me ? 1 : label(a).localeCompare(label(b)))).map(label);

  const tasks = raw.tasks.map((t) => taskOf(t, nameOf));
  const groceries = raw.groceries.map(groceryOf);
  const expenses = raw.expenses.map((e) => expenseOf(e, nameOf, label));
  const notes = raw.notes.map(noteOf);
  const payments = raw.payments.map((p) => paymentOf(p, nameOf));
  return { space: { name: raw.name, members, groupId: raw.groupId, tasks, groceries, expenses, notes, payments }, ids: { ...ids, [you]: raw.me } };
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

  const [group, mem, tasks, groceries, expenses, notes, pay] = await Promise.all([
    sb.from("campus_groups").select("id,name").eq("id", gid).limit(1),
    sb.from("campus_group_memberships").select("user_id").eq("group_id", gid),
    sb.from("household_tasks").select("id,title,assignee,points,done,done_at,due_on,created_at").eq("group_id", gid).order("created_at", { ascending: false }).limit(500),
    sb.from("household_groceries").select("id,name,category,bought").eq("group_id", gid).order("created_at", { ascending: true }).limit(500),
    sb.from("household_expenses").select("id,item,cents,paid_by,split,created_at").eq("group_id", gid).order("created_at", { ascending: false }).limit(500),
    sb.from("household_notes").select("id,title,body").eq("group_id", gid).order("created_at", { ascending: false }).limit(200),
    sb.from("household_payments").select("id,from_user,to_user,cents,created_at").eq("group_id", gid).order("created_at", { ascending: false }).limit(500),
  ]);
  [group, mem, tasks, groceries, expenses, notes].forEach((r) => fail(r.error));
  const g = (group.data ?? [])[0] as { id: string; name: string } | undefined;
  if (!g) return null;

  const members = ((mem.data ?? []) as { user_id: string }[]).map((m) => m.user_id);
  const t = (tasks.data ?? []) as RawTask[], e = (expenses.data ?? []) as RawExpense[];
  // Payments came later than the rest. If the table is not there yet, the household still loads, just without them.
  const p = pay.error ? [] : ((pay.data ?? []) as RawPayment[]);
  const names = await loadNames([...members, ...t.map((x) => x.assignee), ...e.map((x) => x.paid_by), ...e.flatMap((x) => x.split), ...p.flatMap((x) => [x.from_user, x.to_user])].filter((x): x is string => !!x));
  return { me, groupId: g.id, name: g.name, members, tasks: t, groceries: (groceries.data ?? []) as RawGrocery[], expenses: e, notes: (notes.data ?? []) as RawNote[], payments: p, names };
}

export const watchHousehold = (me: string, onChange: () => void, onEvent?: (e: ChangeEvent) => boolean) =>
  watchTables(`orbit-household-${me}`, ["households", "household_tasks", "household_groceries", "household_expenses", "household_notes", "household_payments", "campus_group_memberships"], onChange, onEvent);
