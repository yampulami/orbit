import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { loadNames, watchTables } from "./people";
import { currentUserId } from "./campusOrgs";
import { notice } from "./notice";

/** Club tasks: the team hands out jobs to people in the club and tracks them. The team sees every task; a member sees only their own and can move them along.
 *  The database enforces who may do what; the screen only shows the buttons that will work. */
export type TaskStatus = "todo" | "doing" | "done";
export type RawTask = { id: string; org_id: string; title: string; details: string; assignee_id: string | null; due_at: string | null; status: TaskStatus; created_by: string | null; created_at: string; done_at: string | null };
export type Task = { id: string; title: string; details: string; assigneeId?: string; assignee?: string; dueAt?: string; status: TaskStatus; createdAt: string; doneAt?: string; mine: boolean };

export const STATUS_LABEL: Record<TaskStatus, string> = { todo: "To do", doing: "Doing", done: "Done" };
export const NEXT: Record<TaskStatus, TaskStatus | null> = { todo: "doing", doing: "done", done: null };
export const PREV: Record<TaskStatus, TaskStatus | null> = { todo: null, doing: "todo", done: "doing" };

/** Pure: is a task past its due date and not finished? */
export const isOverdue = (t: Pick<Task, "dueAt" | "status">, now: Date) => t.status !== "done" && !!t.dueAt && new Date(t.dueAt).getTime() < now.getTime();

/** Pure: rows in, what the board shows. Unfinished first (soonest due, then oldest), finished last (most recent first). */
export function buildTasks(raw: RawTask[], names: Record<string, string>, me: string): Task[] {
  return raw
    .map((t): Task => ({
      id: t.id, title: t.title, details: t.details, assigneeId: t.assignee_id ?? undefined, assignee: t.assignee_id ? (t.assignee_id === me ? "You" : names[t.assignee_id] ?? "Member") : undefined,
      dueAt: t.due_at ?? undefined, status: t.status, createdAt: t.created_at, doneAt: t.done_at ?? undefined, mine: t.assignee_id === me,
    }))
    .sort((a, b) => {
      if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
      if (a.status === "done") return (b.doneAt ?? "").localeCompare(a.doneAt ?? "");
      if (!!a.dueAt !== !!b.dueAt) return a.dueAt ? -1 : 1;
      return (a.dueAt ?? "").localeCompare(b.dueAt ?? "") || a.createdAt.localeCompare(b.createdAt);
    });
}

/** What is wrong with a new task, in plain words, or null. */
export function problemWithTask(d: { title: string; details: string }): string | null {
  if (!d.title.trim()) return "Give the task a title.";
  if (d.title.trim().length > 120) return "Keep the title under 120 characters.";
  if (d.details.length > 500) return "Keep the details under 500 characters.";
  return null;
}

/* ---------- store ---------- */
const live = !!supabase;
const DEMO_KEY = "orbit-demo-club-tasks";
const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString();
const demoStart = (): RawTask[] => [
  { id: "t1", org_id: "o1", title: "Book the lab for Thursday", details: "Email facilities and confirm the room until 10 PM.", assignee_id: "demo-sam", due_at: day(1), status: "doing", created_by: "demo-me", created_at: day(-3), done_at: null },
  { id: "t2", org_id: "o1", title: "Order the robotic arm kit", details: "Budget is in the officers channel.", assignee_id: "demo-me", due_at: day(4), status: "todo", created_by: "demo-me", created_at: day(-2), done_at: null },
  { id: "t3", org_id: "o1", title: "Design the spring poster", details: "", assignee_id: "demo-maya", due_at: day(-1), status: "todo", created_by: "demo-sam", created_at: day(-6), done_at: null },
  { id: "t4", org_id: "o1", title: "Collect member t-shirt sizes", details: "", assignee_id: "demo-riley", due_at: null, status: "done", created_by: "demo-me", created_at: day(-9), done_at: day(-4) },
];
const DEMO_NAMES: Record<string, string> = { "demo-sam": "Sam", "demo-riley": "Riley", "demo-maya": "Maya" };
const readDemo = (): RawTask[] => { try { const s = localStorage.getItem(DEMO_KEY); if (s) return JSON.parse(s) as RawTask[]; } catch { /* none saved */ } return demoStart(); };
const writeDemo = (d: RawTask[]) => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(d)); } catch { /* ignore */ } };
const fail = (m: string) => { notice.show({ icon: "alert", title: "That did not work", message: m }); return m; };

/** One club's tasks with the actions to add, assign, move and delete them. Refreshes live. */
export function useClubTasks(orgId: string, enabled = true) {
  const [raw, setRaw] = useState<RawTask[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const mount = useRef(0);
  const me = currentUserId() ?? "";

  const load = useCallback(async () => {
    const id = mount.current;
    if (!live) { setRaw(readDemo().filter((t) => t.org_id === orgId)); setNames(DEMO_NAMES); setReady(true); return; }
    try {
      const r = await supabase!.from("campus_club_tasks").select("id,org_id,title,details,assignee_id,due_at,status,created_by,created_at,done_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(300);
      // Before the tasks migration is applied the table is missing: show no tasks, never an error.
      if (r.error) { if (id === mount.current) { setRaw([]); setReady(true); } return; }
      const rows = (r.data ?? []) as RawTask[];
      const nm = await loadNames(rows.map((t) => t.assignee_id).filter((x): x is string => !!x)).catch(() => ({}));
      if (id !== mount.current) return;
      setRaw(rows); setNames(nm); setReady(true);
    } catch { /* keep what is on screen */ }
  }, [orgId]);

  useEffect(() => {
    if (!enabled) return;
    mount.current++;
    setReady(false);
    void load();
    const stop = live ? watchTables(`orbit-clubtasks-${orgId}`, ["campus_club_tasks"], () => void load()) : () => undefined;
    return () => { mount.current++; stop(); };
  }, [orgId, enabled, load]);

  const run = async (demo: (d: RawTask[]) => RawTask[], remote: () => Promise<{ error: { message: string } | null }>): Promise<string | null> => {
    if (!me) return "Sign in first.";
    if (!live) { writeDemo(demo(readDemo())); await load(); return null; }
    const { error } = await remote();
    if (error) return fail(error.message);
    await load();
    return null;
  };

  const actions = {
    add: (d: { title: string; details: string; assigneeId?: string; dueAt?: string }) => {
      const bad = problemWithTask(d); if (bad) return Promise.resolve(bad);
      const row = { org_id: orgId, title: d.title.trim(), details: d.details.trim(), assignee_id: d.assigneeId || null, due_at: d.dueAt ? new Date(d.dueAt).toISOString() : null };
      return run((l) => [...l, { id: crypto.randomUUID(), status: "todo" as const, created_by: me, created_at: new Date().toISOString(), done_at: null, ...row }],
        () => Promise.resolve(supabase!.from("campus_club_tasks").insert({ ...row, created_by: me })));
    },
    move: (taskId: string, status: TaskStatus) =>
      run((l) => l.map((t) => (t.id === taskId ? { ...t, status, done_at: status === "done" ? new Date().toISOString() : null } : t)), () => Promise.resolve(supabase!.from("campus_club_tasks").update({ status }).eq("id", taskId))),
    assign: (taskId: string, assigneeId: string | null) =>
      run((l) => l.map((t) => (t.id === taskId ? { ...t, assignee_id: assigneeId } : t)), () => Promise.resolve(supabase!.from("campus_club_tasks").update({ assignee_id: assigneeId }).eq("id", taskId))),
    remove: (taskId: string) =>
      run((l) => l.filter((t) => t.id !== taskId), () => Promise.resolve(supabase!.from("campus_club_tasks").delete().eq("id", taskId))),
  };
  const tasks = buildTasks(raw, names, me);
  return { tasks, mine: tasks.filter((t) => t.mine && t.status !== "done"), ready, actions };
}
