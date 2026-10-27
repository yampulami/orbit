import { useMemo } from "react";
import { useHang, isVisible } from "../lib/hangouts";
import { fromYmd, useReminders } from "../lib/reminders";
import { classesOn, useClasses } from "../lib/classes";
import { useCampusEvents } from "../lib/campusEvents";

/** A row of the next two weeks to pick a day from (the phone's stand-in for the month calendar and the week board). A dot means something is planned that day. */
export default function DayStrip({ day, onDay }: { day: string; onDay: (key: string) => void }) {
  const { groups, hangouts } = useHang();
  const reminders = useReminders();
  const classes = useClasses();
  const { events } = useCampusEvents();

  const days = useMemo(() => {
    const t = new Date();
    return Array.from({ length: 14 }, (_, i) => new Date(t.getFullYear(), t.getMonth(), t.getDate() + i));
  }, []);
  const busy = useMemo(() => {
    const set = new Set<string>();
    hangouts.forEach((h) => { if (isVisible(h, groups)) set.add(new Date(h.when).toDateString()); });
    reminders.forEach((r) => { if (!r.done) set.add(fromYmd(r.date).toDateString()); });
    events.forEach((e) => { if (!e.canceled && e.status === "published") set.add(new Date(e.startsAt).toDateString()); });
    days.forEach((d) => { if (classesOn(classes, d).length) set.add(d.toDateString()); });
    return set;
  }, [hangouts, groups, reminders, events, classes, days]);

  return (
    <div className="daystrip" role="listbox" aria-label="Pick a day">
      {days.map((d) => {
        const k = d.toDateString();
        return (
          <button key={k} type="button" role="option" aria-selected={k === day} className={"ds" + (k === day ? " on" : "") + (d.getDay() % 6 === 0 ? " weekend" : "")} onClick={() => onDay(k)}>
            <span>{d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3)}</span>
            <b>{d.getDate()}</b>
            <i className={busy.has(k) ? "dot" : ""} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
