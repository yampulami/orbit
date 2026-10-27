import { CalendarClock } from "lucide-react";
import { isOverdue, NEXT, type useClubTasks } from "../lib/clubTasks";

/** For anyone given a task: your open tasks for this club, with a button to move each one along. */
export default function MyTasks({ board }: { board: ReturnType<typeof useClubTasks> }) {
  if (board.mine.length === 0) return null;
  const now = new Date();
  return (
    <section className="my-tasks" aria-label="Your tasks">
      <h3><CalendarClock size={15} aria-hidden="true" /> Your tasks <span className="rem-count">{board.mine.length}</span></h3>
      <ul>
        {board.mine.map((t) => {
          const next = NEXT[t.status];
          const late = isOverdue(t, now);
          return (
            <li key={t.id} className={late ? "late" : ""}>
              <div><strong>{t.title}</strong>{t.dueAt && <span className={late ? "tb-due late" : "muted"}>{late ? "Overdue, " : "Due "}{new Date(t.dueAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>}</div>
              {next && <button type="button" className="btn" onClick={() => void board.actions.move(t.id, next)}>{next === "done" ? "Mark done" : "Start"}</button>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
