import { useState } from "react";
import { ArrowLeft, ArrowRight, CalendarClock, Plus, Trash2 } from "lucide-react";
import type { Org } from "../lib/campusOrgs";
import { isOverdue, NEXT, PREV, STATUS_LABEL, type Task, type TaskStatus, type useClubTasks } from "../lib/clubTasks";
import DateTimeField from "./DateTimeField";
import EmptyState from "./EmptyState";
import { ArrangeItem, ArrangeList } from "./Arrange";
import { applyOrder, mergeOrder, useSavedOrder } from "../lib/order";

const STATUSES: TaskStatus[] = ["todo", "doing", "done"];
const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

/** The team's task board: To do, Doing and Done. People who can assign tasks add, assign and delete; the person a task is for can move it along. */
export default function TaskBoard({ org, board }: { org: Org; board: ReturnType<typeof useClubTasks> }) {
  const canManage = org.myPerms.includes("tasks");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [who, setWho] = useState("");
  const [due, setDue] = useState("");
  const [error, setError] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [order, setOrder] = useSavedOrder("orbit-task-order:" + org.id);
  const now = new Date();
  // Anyone who belongs to the club can be given a task: the team and the members.
  const people = [...org.members.map((m) => ({ id: m.id, name: m.name })), ...org.clubMembers.filter((c) => !org.members.some((m) => m.id === c.id))];
  const shown = board.tasks.filter((t) => !onlyMine || t.mine);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const err = await board.actions.add({ title, details, assigneeId: who || undefined, dueAt: due || undefined });
    if (err) { setError(err); return; }
    setTitle(""); setDetails(""); setWho(""); setDue(""); setError(""); setAdding(false);
  }

  return (
    <section className="tb" aria-label="Tasks">
      <div className="cevents-top">
        <h2>Tasks</h2>
        <span className="tb-tools">
          <label className="check-line"><input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Just mine</label>
          {canManage && !adding && <button type="button" className="btn" onClick={() => setAdding(true)}><Plus size={15} aria-hidden="true" /> New task</button>}
        </span>
      </div>

      {adding && (
        <form className="tb-form" onSubmit={add}>
          <label className="field">What needs doing?<input autoFocus value={title} maxLength={120} placeholder="e.g. Book the room for Thursday" onChange={(e) => { setTitle(e.target.value); setError(""); }} /></label>
          <label className="field">Details (optional)<textarea rows={2} value={details} maxLength={500} onChange={(e) => setDetails(e.target.value)} /></label>
          <div className="cevent-times">
            <label className="field">Who is it for?
              <select value={who} onChange={(e) => setWho(e.target.value)}><option value="">Nobody yet</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            </label>
            <DateTimeField label="Due (optional)" value={due} optional placeholder="No due date" onChange={setDue} />
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="about-actions"><button className="btn primary" disabled={!title.trim()}>Add task</button><button type="button" className="btn" onClick={() => { setAdding(false); setError(""); }}>Cancel</button></div>
        </form>
      )}

      {!board.ready ? <div className="skeleton sk-tile" aria-busy="true" /> : board.tasks.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No tasks yet">{canManage ? "Add the first one, give it to someone, and track it here." : "When the team assigns something, it shows up here."}</EmptyState>
      ) : (
        <div className="tb-cols">
          {STATUSES.map((s) => {
            const list = applyOrder(shown.filter((t) => t.status === s), order);
            return (
              <div key={s} className={"tb-col " + s}>
                <h3>{STATUS_LABEL[s]} <span className="rem-count">{list.length}</span></h3>
                {list.length === 0 ? <ul><li className="tb-empty muted">Nothing here</li></ul> : (
                  <ArrangeList ids={list.map((t) => t.id)} onChange={(ids) => setOrder(mergeOrder(order, ids))}>
                    {list.map((t) => <TaskCard key={t.id} t={t} overdue={isOverdue(t, now)} canManage={canManage} people={people} board={board} arrange />)}
                  </ArrangeList>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function TaskCard({ t, overdue, canManage, people, board, arrange = false }: { t: Task; overdue: boolean; canManage: boolean; people: { id: string; name: string }[]; board: ReturnType<typeof useClubTasks>; /** Inside an ArrangeList: the card can be dragged by its grip. */ arrange?: boolean }) {
  const [sure, setSure] = useState(false);
  const canMove = canManage || t.mine;
  const prev = PREV[t.status], next = NEXT[t.status];
  const cls = "tb-card" + (overdue ? " overdue" : "") + (t.mine ? " mine" : "");
  const body = (
    <>
      <strong>{t.title}</strong>
      {t.details && <p className="muted">{t.details}</p>}
      <div className="tb-meta">
        {t.dueAt && <span className={"tb-due" + (overdue ? " late" : "")}><CalendarClock size={12} aria-hidden="true" /> {overdue ? "Overdue, " : "Due "}{when(t.dueAt)}</span>}
        {canManage ? (
          <select className="role-pick" aria-label={`Who is ${t.title} for`} value={t.assigneeId ?? ""} onChange={(e) => void board.actions.assign(t.id, e.target.value || null)}>
            <option value="">Unassigned</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : <span className="tb-who">{t.assignee ?? "Unassigned"}</span>}
      </div>
      {canMove && (
        <div className="tb-actions">
          {prev && <button type="button" className="link-btn" aria-label={`Move ${t.title} back to ${STATUS_LABEL[prev]}`} onClick={() => void board.actions.move(t.id, prev)}><ArrowLeft size={13} aria-hidden="true" /> {STATUS_LABEL[prev]}</button>}
          {next && <button type="button" className="btn tb-next" onClick={() => void board.actions.move(t.id, next)}>{next === "done" ? "Mark done" : "Start"} <ArrowRight size={14} aria-hidden="true" /></button>}
          {canManage && (sure
            ? <span className="cevent-sure"><button type="button" className="btn danger" onClick={() => void board.actions.remove(t.id)}>Delete</button><button type="button" className="btn" onClick={() => setSure(false)}>Keep</button></span>
            : <button type="button" className="link-btn" aria-label={`Delete ${t.title}`} onClick={() => setSure(true)}><Trash2 size={13} aria-hidden="true" /></button>)}
        </div>
      )}
    </>
  );
  return arrange ? <ArrangeItem id={t.id} handle label={t.title} className={cls}>{body}</ArrangeItem> : <li className={cls}>{body}</li>;
}
