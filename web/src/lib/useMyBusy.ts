import { useMemo } from "react";
import { useClasses } from "./classes";
import { useHang, isVisible } from "./hangouts";
import { YOU } from "./hangTypes";
import { useCampusEvents } from "./campusEvents";
import { useReminders } from "./reminders";
import { buildMyBusy, busyOn, type BusyInput, type BusyItem } from "./myBusy";
import type { Person } from "./freeTime";

/** The student's own busy time, kept in step with their classes, hangouts, events and reminders. */
export function useMyBusy(now: Date): { me: Person; input: BusyInput; today: BusyItem[] } {
  const classes = useClasses();
  const { groups, hangouts } = useHang();
  const { events } = useCampusEvents();
  const reminders = useReminders();
  const input: BusyInput = useMemo(() => ({
    classes,
    hangouts: hangouts.map((h) => ({ title: h.title, when: h.when, canceled: h.canceled, rsvp: h.rsvps[YOU] ?? null, visible: isVisible(h, groups) })),
    events,
    reminders: reminders as BusyInput["reminders"],
  }), [classes, hangouts, groups, events, reminders]);
  const minute = Math.floor(now.getTime() / 60000);
  const me = useMemo(() => buildMyBusy(input, now), [input, minute]); // eslint-disable-line react-hooks/exhaustive-deps
  const today = useMemo(() => busyOn(input, now), [input, minute]); // eslint-disable-line react-hooks/exhaustive-deps
  return { me, input, today };
}
