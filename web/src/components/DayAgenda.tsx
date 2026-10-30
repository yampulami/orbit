import { SweepLi, SweepUl } from "./Sweep";
import StackedList from "./StackedList";
import { Link } from "react-router-dom";
import { GraduationCap, MapPin, Users } from "lucide-react";
import PinButton from "./PinButton";
import RemindersPanel from "./RemindersPanel";
import { hangActions, isVisible, useHang, YOU } from "../lib/hangouts";
import { classesOn, clockLabel, useClasses } from "../lib/classes";
import { useCampusEvents, type CampusEvent } from "../lib/campusEvents";
import { EventBadge } from "./EventCard";

const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** Everything on one day, in one place: the hangouts to answer, and the reminders with a quick way to add one. */
export default function DayAgenda({ day }: { day: string }) {
  const { groups, hangouts } = useHang();
  const d = new Date(day);
  const isToday = day === new Date().toDateString();
  const list = hangouts
    .filter((h) => isVisible(h, groups) && new Date(h.when).toDateString() === day)
    .sort((a, b) => a.when.localeCompare(b.when));
  const asking = list.filter((h) => !h.rsvps[YOU]).length;
  const classes = classesOn(useClasses(), d);
  const dayEvents = useCampusEvents().events.filter((e) => e.status === "published" && !e.canceled && new Date(e.startsAt).toDateString() === day);

  // The day's classes and campus events, in time order, folded into one bar like the other lists.
  type Row = { key: string; at: number; time: string; end?: string; title: string; place?: string; kind: "class" | "event"; event?: CampusEvent };
  const rows: Row[] = [
    ...classes.map((c): Row => { const [h, m] = c.start.split(":").map(Number); return { key: c.id, at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime(), time: clockLabel(c.start), end: clockLabel(c.end), title: c.name, place: c.place, kind: "class" }; }),
    ...dayEvents.map((e): Row => ({ key: e.id, at: new Date(e.startsAt).getTime(), time: clock(e.startsAt), title: e.title, place: e.place, kind: "event", event: e })),
  ].sort((a, b) => a.at - b.at);
  const next = isToday ? rows.find((r) => r.at > Date.now()) : undefined;
  const summary = [classes.length ? `${classes.length} ${classes.length === 1 ? "class" : "classes"}` : "", dayEvents.length ? `${dayEvents.length} ${dayEvents.length === 1 ? "event" : "events"}` : ""].filter(Boolean).join(" · ") + (next ? ` · next ${next.time}` : "");

  return (
    <section className="agenda" aria-label="Selected day">
      <header>
        <h2>{d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h2>
        <p>{isToday ? "Today" : d.toLocaleDateString(undefined, { year: "numeric" })}
          {list.length > 0 && ` · ${list.length} hangout${list.length === 1 ? "" : "s"}`}
          {asking > 0 && ` · ${asking} need${asking === 1 ? "s" : ""} your answer`}</p>
      </header>
      {rows.length > 0 && (
        <StackedList
          key={day}
          title="Classes and events"
          subtitle={summary}
          icon={<GraduationCap size={18} />}
          items={rows}
          getKey={(r) => r.key}
          defaultOpen={rows.length <= 2}
          renderItem={(r) => (
            <div className={"ag-row x-" + r.kind}>
              <b>{r.time}{r.end && <small>to {r.end}</small>}</b>
              <span>{r.title}{r.place && <small>{r.place}</small>}</span>
              {r.kind === "class" ? <em>Class</em> : r.event && <EventBadge e={r.event} />}
            </div>
          )}
        />
      )}
      <div className="agenda-grid">
        <div className="agenda-hangs">
          <h3><Users size={15} aria-hidden="true" />Group hangouts <span className="agenda-sub">private plans with your groups</span></h3>
          {list.length === 0 ? (
            <p className="rem-empty">No hangouts yet. <Link to="/app/groups">Plan a hangout</Link></p>
          ) : (
            <SweepUl>
              {list.map((h) => {
                const mine = h.rsvps[YOU];
                return (
                  <SweepLi key={h.id} className={"a-" + (mine ?? "pending")}>
                    <div className="agenda-info">
                      <strong>{h.title}</strong>
                      <span>{clock(h.when)} · <MapPin size={12} aria-hidden="true" />{h.place}</span>
                    </div>
                    <PinButton kind="hangout" id={h.id} title={h.title} />
                    <div className="cal-hbtns" role="group" aria-label={`Are you going to ${h.title}?`}>
                      <button type="button" data-a="yes" aria-pressed={mine === "yes"} onClick={() => hangActions.setRsvp(h.id, mine === "yes" ? null : "yes")}>Yes</button>
                      <button type="button" data-a="no" aria-pressed={mine === "no"} onClick={() => hangActions.setRsvp(h.id, mine === "no" ? null : "no")}>No</button>
                    </div>
                  </SweepLi>
                );
              })}
            </SweepUl>
          )}
        </div>
        <RemindersPanel day={day} />
      </div>
    </section>
  );
}
