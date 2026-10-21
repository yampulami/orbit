import { useSyncExternalStore } from "react";

/** Themed popups for things that did not work or were blocked, in the app's own voice instead of a browser alert.
 *  Say what happened, why, and what to do next. */
export type NoticeIcon = "pin" | "calendar" | "alert" | "wifi";
export type NoticeAction = { label: string; onClick: () => void };
export type Notice = { id: number; title: string; message: string; icon: NoticeIcon; actions: NoticeAction[]; timer: ReturnType<typeof setTimeout> };

let items: Notice[] = [];
let next = 1;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const notice = {
  show(o: { title: string; message: string; icon?: NoticeIcon; actions?: NoticeAction[]; ms?: number }): number {
    // The same problem twice in a row stays one popup, with its timer restarted.
    const dup = items.find((x) => x.title === o.title && x.message === o.message);
    if (dup) { clearTimeout(dup.timer); dup.timer = setTimeout(() => notice.dismiss(dup.id), o.ms ?? 7000); emit(); return dup.id; }
    const id = next++;
    const timer = setTimeout(() => notice.dismiss(id), o.ms ?? 7000);
    items = [...items, { id, title: o.title, message: o.message, icon: o.icon ?? "alert", actions: o.actions ?? [], timer }];
    emit();
    return id;
  },
  dismiss(id: number) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    clearTimeout(it.timer);
    items = items.filter((x) => x.id !== id);
    emit();
  },
};

export const useNotices = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => items);
