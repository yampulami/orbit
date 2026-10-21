import { useSyncExternalStore } from "react";
import { hangActions, YOU } from "./hangouts";
import { undo } from "./undo";

/** One shared household: chores, groceries, expenses and notes. Saved on this device only until roommate spaces sync to the server. */
export type Points = 1 | 2 | 3 | 5;
export type Task = { id: string; title: string; assignee: string; points: Points; done: boolean; createdAt: string; doneAt?: string; /** Optional due date, "YYYY-MM-DD". */ due?: string };
export type Grocery = { id: string; name: string; category: string; bought: boolean };
export type Expense = { id: string; item: string; cents: number; paidBy: string; split: string[]; at: string };
export type Note = { id: string; title: string; body: string };
export type Space = { name: string; members: string[]; groupId?: string; tasks: Task[]; groceries: Grocery[]; expenses: Expense[]; notes: Note[] };
export type Kind = "tasks" | "groceries" | "expenses" | "notes";

export const CATEGORIES = ["Produce", "Dairy", "Pantry", "Snacks", "Cleaning", "Other"] as const;
export const POINTS: Points[] = [1, 2, 3, 5];
const DAY = 86400000;

/* ---------- pure helpers (tested) ---------- */

/** Open effort points per person: the workload that auto-assign balances. */
export function workload(members: string[], tasks: Task[]) {
  const out: Record<string, { open: number; openCount: number; done: number }> = {};
  members.forEach((m) => { out[m] = { open: 0, openCount: 0, done: 0 }; });
  const since = Date.now() - 30 * DAY;
  for (const t of tasks) {
    const w = out[t.assignee] ?? (out[t.assignee] = { open: 0, openCount: 0, done: 0 });
    if (!t.done) { w.open += t.points; w.openCount += 1; }
    else if (new Date(t.doneAt ?? t.createdAt).getTime() >= since) w.done += t.points;
  }
  return out;
}

/** The roommate with the least open work. Ties go to whoever has fewer open chores, then to list order. */
export function autoAssignee(members: string[], tasks: Task[]) {
  const w = workload(members, tasks);
  return [...members].sort((a, b) => (w[a].open - w[b].open) || (w[a].openCount - w[b].openCount) || (members.indexOf(a) - members.indexOf(b)))[0];
}

/** What each person is owed (positive) or owes (negative), in cents. Splits are equal and odd cents go to the first people in the split. */
export function netBalances(members: string[], expenses: Expense[]) {
  const net: Record<string, number> = {};
  members.forEach((m) => { net[m] = 0; });
  for (const e of expenses) {
    const split = e.split.length ? e.split : members;
    const base = Math.floor(e.cents / split.length);
    const extra = e.cents - base * split.length;
    split.forEach((m, i) => { net[m] = (net[m] ?? 0) - (base + (i < extra ? 1 : 0)); });
    net[e.paidBy] = (net[e.paidBy] ?? 0) + e.cents;
  }
  return net;
}

/** The fewest payments that settle everyone up (greedy: biggest debtor pays biggest creditor). */
export function settlements(net: Record<string, number>) {
  const debtors = Object.entries(net).filter(([, c]) => c < 0).map(([n, c]) => ({ n, c: -c })).sort((a, b) => b.c - a.c);
  const creditors = Object.entries(net).filter(([, c]) => c > 0).map(([n, c]) => ({ n, c })).sort((a, b) => b.c - a.c);
  const out: { from: string; to: string; cents: number }[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].c, creditors[j].c);
    if (pay > 0) out.push({ from: debtors[i].n, to: creditors[j].n, cents: pay });
    debtors[i].c -= pay; creditors[j].c -= pay;
    if (debtors[i].c === 0) i++;
    if (creditors[j].c === 0) j++;
  }
  return out;
}

/** "12.5" or "$1,200" to cents. Returns null for anything that is not a positive amount. */
export function parseCents(input: string): number | null {
  const clean = input.replace(/[$,\s]/g, "");
  if (!/^\d*\.?\d{0,2}$/.test(clean) || clean === "" || clean === ".") return null;
  const cents = Math.round(parseFloat(clean) * 100);
  return cents > 0 ? cents : null;
}

export const money = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

export const TONES = ["var(--pink)", "var(--peach)", "var(--lav)", "var(--mint)", "var(--butter)"];
export const toneOf = (name: string, members: string[]) => TONES[Math.max(0, members.indexOf(name)) % TONES.length];

/* ---------- store ---------- */

type State = { space: Space | null };
const KEY = "orbit-roommates-v1";

function load(): State {
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s) as State; } catch { /* storage unavailable */ }
  return { space: null };
}

let state: State = load();
const subs = new Set<() => void>();
function set(next: State) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  subs.forEach((f) => f());
}
const patch = (fn: (s: Space) => Space) => { if (state.space) set({ space: fn(state.space) }); };
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const say = (text: string) => { if (state.space?.groupId) hangActions.send(state.space.groupId, text); };

export const roomActions = {
  /** Making a household also makes its private group chat, so updates can post there. */
  createSpace(name: string, others: string[]) {
    const members = [YOU, ...others.filter((m) => m && m !== YOU)];
    const groupId = hangActions.createGroup(name, members.slice(1));
    set({ space: { name, members, groupId, tasks: [], groceries: [], expenses: [], notes: [] } });
  },
  /** A filled-in household so the screens have something to show. */
  createSample() {
    const members = [YOU, "Maya", "Jordan", "Priya"];
    const groupId = hangActions.createGroup("Hamilton 3F", members.slice(1));
    const ago = (d: number) => new Date(Date.now() - d * DAY).toISOString();
    const inDays = (d: number) => { const x = new Date(Date.now() + d * DAY); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
    set({
      space: {
        name: "Hamilton 3F", members, groupId,
        tasks: [
          { id: uid(), title: "Take out the trash", assignee: "Maya", points: 1, done: false, createdAt: ago(1), due: inDays(0) },
          { id: uid(), title: "Clean the bathroom", assignee: YOU, points: 5, done: false, createdAt: ago(2), due: inDays(2) },
          { id: uid(), title: "Vacuum the common room", assignee: "Jordan", points: 2, done: true, createdAt: ago(6), doneAt: ago(4) },
          { id: uid(), title: "Wipe the kitchen counters", assignee: "Priya", points: 2, done: true, createdAt: ago(8), doneAt: ago(5) },
          { id: uid(), title: "Replace the water filter", assignee: YOU, points: 3, done: true, createdAt: ago(12), doneAt: ago(9) },
        ],
        groceries: [
          { id: uid(), name: "Bananas", category: "Produce", bought: false },
          { id: uid(), name: "Oat milk", category: "Dairy", bought: false },
          { id: uid(), name: "Pasta", category: "Pantry", bought: true },
          { id: uid(), name: "Dish soap", category: "Cleaning", bought: false },
        ],
        expenses: [
          { id: uid(), item: "Internet bill", cents: 6000, paidBy: "Jordan", split: members, at: ago(3) },
          { id: uid(), item: "Pizza night", cents: 3200, paidBy: YOU, split: members, at: ago(2) },
          { id: uid(), item: "Paper towels", cents: 1299, paidBy: "Maya", split: members, at: ago(1) },
        ],
        notes: [
          { id: uid(), title: "Quiet hours", body: "Quiet from 10pm to 8am on weeknights. Headphones after that." },
          { id: uid(), title: "Maintenance", body: "Hallway light is out. Request already sent to the front desk." },
        ],
      },
    });
  },
  addMembers(names: string[]) {
    patch((s) => ({ ...s, members: [...s.members, ...names.filter((n) => n && !s.members.includes(n))] }));
  },
  addTask(title: string, assignee: string | "auto", points: Points, due?: string) {
    const s = state.space; if (!s) return;
    const who = assignee === "auto" ? autoAssignee(s.members, s.tasks) : assignee;
    patch((sp) => ({ ...sp, tasks: [{ id: uid(), title, assignee: who, points, done: false, createdAt: now(), due: due || undefined }, ...sp.tasks] }));
    say(`New chore: ${title}, assigned to ${who === YOU ? "me" : who} (${points} pt${points === 1 ? "" : "s"})${due ? `, due ${due}` : ""}`);
  },
  setTaskDone(id: string, done: boolean) {
    patch((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, done, doneAt: done ? now() : undefined } : t)) }));
  },
  reassign(id: string, assignee: string) {
    patch((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, assignee } : t)) }));
  },
  addGrocery(name: string, category: string) {
    patch((s) => ({ ...s, groceries: [...s.groceries, { id: uid(), name, category, bought: false }] }));
  },
  setBought(id: string, bought: boolean) {
    patch((s) => ({ ...s, groceries: s.groceries.map((g) => (g.id === id ? { ...g, bought } : g)) }));
  },
  addExpense(item: string, cents: number, paidBy: string) {
    const s = state.space; if (!s) return;
    patch((sp) => ({ ...sp, expenses: [{ id: uid(), item, cents, paidBy, split: sp.members, at: now() }, ...sp.expenses] }));
    say(`Added expense: ${item}, ${money(cents)} paid by ${paidBy === YOU ? "me" : paidBy}`);
  },
  addNote(title: string, body: string) {
    patch((s) => ({ ...s, notes: [{ id: uid(), title, body }, ...s.notes] }));
  },
  /** Removing returns what was removed and where it was, so Undo can put it back in the same spot. */
  remove(kind: Kind, id: string) {
    const s = state.space; if (!s) return null;
    const list = s[kind] as { id: string }[];
    const index = list.findIndex((x) => x.id === id);
    if (index < 0) return null;
    const item = list[index];
    patch((sp) => ({ ...sp, [kind]: (sp[kind] as { id: string }[]).filter((x) => x.id !== id) }));
    return { item, index };
  },
  restore(kind: Kind, item: { id: string }, index: number) {
    patch((s) => {
      const list = [...(s[kind] as { id: string }[])];
      if (list.some((x) => x.id === item.id)) return s;
      list.splice(Math.min(index, list.length), 0, item);
      return { ...s, [kind]: list };
    });
  },
  leave() { set({ space: null }); },
};

export const useSpace = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state.space);

/** Deletes something from the household and offers Undo for a few seconds. */
export function removeWithUndo(kind: Kind, id: string, label: string) {
  const removed = roomActions.remove(kind, id);
  if (!removed) return;
  undo.show(`${label} deleted`, { onUndo: () => roomActions.restore(kind, removed.item, removed.index), commit: () => {} });
}
