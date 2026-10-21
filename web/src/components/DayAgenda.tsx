import { Link } from "react-router-dom";
import { MapPin, Users } from "lucide-react";
import PinButton from "./PinButton";
import RemindersPanel from "./RemindersPanel";
import { hangActions, useHang, YOU } from "../lib/hangouts";

const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** Everything on one day, in one place: the hangouts to answer, and the reminders with a quick way to add one. */
export default function DayAgenda({ day }: { day: string }) {
  const { groups, hangouts } = useHang();
  const d = new Date(day);
  const isToday = day === new Date().toDateString();
  const list = hangouts
    .filter((h) => !h.canceled && groups.some((g) => g.id === h.groupId) && new Date(h.when).toDateString() === day)
    .sort((a, b) => a.when.localeCompare(b.when));
  const asking = list.filter((h) => !h.rsvps[YOU]).length;

  return (
    <section className="agenda" aria-label="Selected day">
      <header>
        <h2>{d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h2>
        <p>{isToday ? "Today" : d.toLocaleDateString(undefined, { year: "numeric" })}
          {list.length > 0 && ` · ${list.length} hangout${list.length === 1 ? "" : "s"}`}
          {asking > 0 && ` · ${asking} need${asking === 1 ? "s" : ""} your answer`}</p>
      </header>
      <div className="agenda-grid">
        <div className="agenda-hangs">
          <h3><Users size={15} aria-hidden="true" />Hangouts</h3>
          {list.length === 0 ? (
            <p className="rem-empty">No hangouts. <Link to="/app/groups">Plan one</Link></p>
          ) : (
            <ul>
              {list.map((h) => {
                const mine = h.rsvps[YOU];
                return (
                  <li key={h.id} className={"a-" + (mine ?? "pending")}>
                    <div className="agenda-info">
                      <strong>{h.title}</strong>
                      <span>{clock(h.when)} · <MapPin size={12} aria-hidden="true" />{h.place}</span>
                    </div>
                    <PinButton kind="hangout" id={h.id} title={h.title} />
                    <div className="cal-hbtns" role="group" aria-label={`Are you going to ${h.title}?`}>
                      <button type="button" data-a="yes" aria-pressed={mine === "yes"} onClick={() => hangActions.setRsvp(h.id, mine === "yes" ? null : "yes")}>Yes</button>
                      <button type="button" data-a="no" aria-pressed={mine === "no"} onClick={() => hangActions.setRsvp(h.id, mine === "no" ? null : "no")}>No</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <RemindersPanel day={day} />
      </div>
    </section>
  );
}
