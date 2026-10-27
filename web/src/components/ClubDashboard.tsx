import { CalendarDays, Check, ClipboardList, UserPlus } from "lucide-react";
import type { Org } from "../lib/campusOrgs";
import type { CampusEvent } from "../lib/campusEvents";
import { isOpen } from "../lib/campusEvents";
import { isOverdue, type useClubTasks } from "../lib/clubTasks";
import { eventWhen } from "./EventCard";
import TaskBoard from "./TaskBoard";
import RichText from "./RichText";

/** The team's private dashboard: what needs attention right now, what is coming up, and the task board. Only the club's team sees it. */
export default function ClubDashboard({ org, events, board, reviewer, go }: { org: Org; events: CampusEvent[]; board: ReturnType<typeof useClubTasks>; reviewer: boolean; go: (tab: "people" | "events") => void }) {
  const now = new Date();
  const canMembers = org.myPerms.includes("members") || reviewer;
  const waiting = events.filter((e) => e.orgId === org.id && e.status === "pending" && !e.canceled);
  const overdue = board.tasks.filter((t) => isOverdue(t, now));
  const open = board.tasks.filter((t) => t.status !== "done");
  const soon = events.filter((e) => e.status === "published" && !e.canceled && isOpen(e, now)).slice(0, 3);
  const items = [
    ...(canMembers && org.requests.length > 0 ? [{ key: "req", icon: UserPlus, text: `${org.requests.length} ${org.requests.length === 1 ? "person is" : "people are"} waiting to join`, action: "Answer", onClick: () => go("people") }] : []),
    ...(waiting.length > 0 ? [{ key: "ev", icon: CalendarDays, text: `${waiting.length} ${waiting.length === 1 ? "event is" : "events are"} waiting for a coordinator`, action: "See events", onClick: () => go("events") }] : []),
    ...(overdue.length > 0 ? [{ key: "late", icon: ClipboardList, text: `${overdue.length} ${overdue.length === 1 ? "task is" : "tasks are"} overdue`, action: "", onClick: undefined }] : []),
  ];

  return (
    <section className="dash" aria-label="Team dashboard">
      <div className="dash-top">
        <div className="dash-attn">
          <h2>Needs attention</h2>
          {items.length === 0
            ? <p className="dash-clear"><Check size={16} aria-hidden="true" /> You are all caught up.{open.length > 0 ? ` ${open.length} ${open.length === 1 ? "task is" : "tasks are"} still open.` : ""}</p>
            : <ul>{items.map((i) => (
                <li key={i.key}><i.icon size={16} aria-hidden="true" /><span>{i.text}</span>{i.onClick && <button type="button" className="link-btn" onClick={i.onClick}>{i.action}</button>}</li>
              ))}</ul>}
        </div>
        <div className="dash-soon">
          <h2>Coming up</h2>
          {soon.length === 0 ? <p className="muted">No events scheduled.</p> : <ul>{soon.map((e) => <li key={e.id}><strong><RichText text={e.title} /></strong><span className="muted">{eventWhen(e)}</span></li>)}</ul>}
        </div>
      </div>
      <TaskBoard org={org} board={board} />
    </section>
  );
}
