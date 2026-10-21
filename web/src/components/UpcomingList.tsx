import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Check, ListChecks, Users } from "lucide-react";
import { useHang } from "../lib/hangouts";
import { reminderActions, useReminders } from "../lib/reminders";
import { useSpace } from "../lib/roommates";
import PinButton from "./PinButton";
import { usePins } from "../lib/pins";
import { buildUpcoming, type UpKind, type UpTag } from "../lib/upcoming";

const ICON: Record<UpKind, typeof Bell> = { hangout: Users, chore: ListChecks, reminder: Bell };
const TAG: Record<UpTag, string> = { answer: "Needs your answer", overdue: "Overdue", today: "Today", soon: "Soon", tomorrow: "Tomorrow" };

/** What is coming up: hangouts (with what needs an answer), your chores in the house, and reminders you set on the calendar. */
export default function UpcomingList({ limit = 5, moreTo, hide = [], title = "Coming up" }: { limit?: number; moreTo?: string; /** Kinds to leave out, for example hangouts on Home where they already have their own row. */ hide?: UpKind[]; title?: string }) {
  const { groups, hangouts } = useHang();
  const space = useSpace();
  const reminders = useReminders();
  const nav = useNavigate();
  const [all, setAll] = useState(false);
  const [leaving, setLeaving] = useState<string | null>(null);
  const finish = (id: string, reminderId: string) => { setLeaving(id); setTimeout(() => { reminderActions.setDone(reminderId, true); setLeaving(null); }, 260); };

  const pins = usePins();
  const isPinned = (it: { kind: UpKind; id: string; reminderId?: string }) => pins.some((p) => p.kind === it.kind && p.id === (it.reminderId ?? it.id.replace(/^[a-z]-/, "")));
  // Pinned things lead the list, otherwise soonest first.
  const items = buildUpcoming({ now: new Date(), groups, hangouts, tasks: space?.tasks ?? [], reminders })
    .filter((it) => !hide.includes(it.kind))
    .sort((a, b) => Number(isPinned(b)) - Number(isPinned(a)));
  const visible = all && !moreTo ? items.length : limit;
  const shown = items.slice(0, 12);

  return (
    <section className={"up" + (items.some(isPinned) ? " has-pins" : "")} aria-label={title}>
      <header><h3>{title}</h3>{items.length > 0 && <span className="muted">{items.length}</span>}</header>
      {items.length === 0 ? (
        <p className="up-empty">Nothing here. Pick a day on the calendar to add a reminder, or plan a hangout.</p>
      ) : (
        <ul>
          {shown.map((it, i) => {
            const Icon = ICON[it.kind];
            return (
              <li key={it.id} data-kind={it.kind} className={[i >= visible ? "fold" : "", isPinned(it) ? "is-pinned" : "", leaving === it.id ? "leaving" : ""].join(" ").trim() || undefined} inert={i >= visible}>
                <button type="button" className="up-main" title={`${it.title}, ${it.sub}`} onClick={() => nav(it.to, { state: it.state })}>
                  <span className="up-ico" aria-hidden="true"><Icon size={16} strokeWidth={1.9} /></span>
                  <span className="up-text"><strong>{it.title}</strong><span className="up-sub">{it.sub}</span></span>
                  {it.tag && <span className="up-tag" data-tag={it.tag}>{TAG[it.tag]}</span>}
                </button>
                <PinButton kind={it.kind} id={it.reminderId ?? it.id.replace(/^[a-z]-/, "")} title={it.title} />
                {it.reminderId && (
                  <button type="button" className="check" role="checkbox" aria-checked={leaving === it.id} aria-label={`Mark done: ${it.title}`} onClick={() => finish(it.id, it.reminderId!)}><Check size={14} strokeWidth={2.4} aria-hidden="true" /></button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {items.length > limit && (moreTo
        ? <Link className="up-more" to={moreTo}>See all {items.length}</Link>
        : <button type="button" className="up-more" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${items.length}`}</button>)}
    </section>
  );
}
