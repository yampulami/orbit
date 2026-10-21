import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { enter, exit } from "../lib/motion";
import HangoutCard, { fmtWhen } from "./HangoutCard";
import RemindersPanel from "./RemindersPanel";
import { hangActions, isVisible, useHang, YOU, type Hangout } from "../lib/hangouts";
import { fromYmd, useReminders } from "../lib/reminders";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

type Mark = "pending" | "no" | "yes";
const markOf = (h: Hangout): Mark => h.rsvps[YOU] ?? "pending";
const MARK_TEXT: Record<Mark, string> = { pending: "needs your answer", no: "you are not going", yes: "you are all set" };
/** One color per day: unanswered first, then going, then not going. */
const dayMark = (hs: Hangout[]): Mark | undefined => {
  const marks = hs.map(markOf);
  return (["pending", "yes", "no"] as const).find((m) => marks.includes(m));
};

/** Month grid. Dots mark days with posts, tinted days have hangouts, a small bell marks days with reminders. `day` is a Date.toDateString() key. */
export default function Calendar({ posts, day, onDay, compact = false, details = true }: {
  posts: { created_at: string }[];
  day: string | null;
  onDay: (key: string | null) => void;
  /** In the narrow right column, hangouts on the picked day show as short rows instead of full cards. */
  compact?: boolean;
  /** Show the picked day's reminders and hangouts under the grid. Plans shows them in its own agenda instead. */
  details?: boolean;
}) {
  const { groups, hangouts } = useHang();
  const reminders = useReminders();
  const [month, setMonth] = useState(() => {
    // Open on the month of the picked day, for example when a search result sent you here.
    if (!day) return 0;
    const d = new Date(day), t = new Date();
    return (d.getFullYear() - t.getFullYear()) * 12 + d.getMonth() - t.getMonth();
  });
  const [cursor, setCursor] = useState<string | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const view = new Date(today.getFullYear(), today.getMonth() + month, 1);
  const lead = view.getDay();
  const total = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((lead + total) / 7) * 7 }, (_, k) => new Date(view.getFullYear(), view.getMonth(), k - lead + 1));
  const withPosts = new Set(posts.map((p) => new Date(p.created_at).toDateString()));
  const withReminders = new Set(reminders.filter((r) => !r.done).map((r) => fromYmd(r.date).toDateString()));

  // Hangouts by day. A past hangout nobody answered no longer asks for attention.
  const byDay = new Map<string, Hangout[]>();
  for (const h of hangouts) {
    if (!isVisible(h, groups)) continue;
    if (!h.rsvps[YOU] && new Date(h.when).getTime() < Date.now()) continue;
    const k = new Date(h.when).toDateString();
    byDay.set(k, [...(byDay.get(k) ?? []), h]);
  }
  // One tab stop for the whole grid: the cursor day, else the picked day, else today, else the 1st of the month.
  const keys = cells.map((d) => d.toDateString());
  const stop = [cursor, day, today.toDateString()].find((k) => k && keys.includes(k)) ?? view.toDateString();

  useEffect(() => {
    if (!moved.current || !cursor) return;
    moved.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-key="${cursor}"]`)?.focus();
  }, [cursor, month]);

  function onKeys(e: KeyboardEvent) {
    const from = (e.target as HTMLElement).closest<HTMLElement>("[data-key]")?.dataset.key;
    if (!from) return;
    const d = new Date(from);
    const step: Record<string, () => void> = {
      ArrowLeft: () => d.setDate(d.getDate() - 1),
      ArrowRight: () => d.setDate(d.getDate() + 1),
      ArrowUp: () => d.setDate(d.getDate() - 7),
      ArrowDown: () => d.setDate(d.getDate() + 7),
      Home: () => d.setDate(d.getDate() - d.getDay()),
      End: () => d.setDate(d.getDate() + 6 - d.getDay()),
      PageUp: () => d.setMonth(d.getMonth() - 1),
      PageDown: () => d.setMonth(d.getMonth() + 1),
    };
    if (!step[e.key]) return;
    e.preventDefault();
    step[e.key]();
    moved.current = true;
    setMonth((d.getFullYear() - today.getFullYear()) * 12 + d.getMonth() - today.getMonth());
    setCursor(d.toDateString());
  }

  const chosen = day ? (byDay.get(day) ?? []).sort((a, b) => a.when.localeCompare(b.when)) : [];

  return (
    <section className="cal" aria-label="Campus calendar">
      <header>
        <h2>{view.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
        <div>
          <button type="button" aria-label="Previous month" onClick={() => setMonth((m) => m - 1)}><ChevronLeft size={18} /></button>
          <button type="button" aria-label="Next month" onClick={() => setMonth((m) => m + 1)}><ChevronRight size={18} /></button>
        </div>
      </header>
      <div className="cal-grid" ref={grid} onKeyDown={onKeys} role="group" aria-label="Pick a day">
        {WEEKDAYS.map((d) => <span key={d} className="cal-wd">{d}</span>)}
        {cells.map((d) => {
          const key = d.toDateString();
          const mark = byDay.has(key) ? dayMark(byDay.get(key)!) : undefined;
          const cls = ["cal-day", d.getMonth() !== view.getMonth() ? "out" : "", withPosts.has(key) ? "has" : "", withReminders.has(key) ? "rem" : "", key === today.toDateString() ? "today" : "", mark ? `hm-${mark}` : "", key === day ? "sel" : ""].join(" ");
          const label = d.toLocaleDateString(undefined, { dateStyle: "full" }) + (mark ? `, hangout: ${MARK_TEXT[mark]}` : "") + (withReminders.has(key) ? ", has a reminder" : "");
          return <button key={key} type="button" data-key={key} tabIndex={key === stop ? 0 : -1} className={cls} aria-pressed={key === day} aria-label={label} title={mark ? MARK_TEXT[mark] : withReminders.has(key) ? "Has a reminder" : undefined} onClick={() => onDay(key === day ? null : key)}>{d.getDate()}</button>;
        })}
      </div>
      <AnimatePresence initial={false}>
        {day && details && (
          <motion.div key="details" className="cal-details" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1, transition: enter }} exit={{ height: 0, opacity: 0, transition: exit }}>
          <RemindersPanel day={day} />
        {chosen.length > 0 && (
          <div className="cal-hangs">
            {compact
              ? chosen.map((h) => {
                  const mine = h.rsvps[YOU];
                  return (
                    <div key={h.id} className="cal-hrow">
                      <div className="cal-hinfo"><strong>{h.title}</strong><span>{fmtWhen(h.when)} · {h.place}</span></div>
                      <div className="cal-hbtns" role="group" aria-label={`Are you going to ${h.title}?`}>
                        <button type="button" data-a="yes" aria-pressed={mine === "yes"} onClick={() => hangActions.setRsvp(h.id, mine === "yes" ? null : "yes")}>Yes</button>
                        <button type="button" data-a="no" aria-pressed={mine === "no"} onClick={() => hangActions.setRsvp(h.id, mine === "no" ? null : "no")}>No</button>
                      </div>
                    </div>
                  );
                })
              : chosen.map((h, i) => <HangoutCard key={h.id} h={h} group={groups.find((g) => g.id === h.groupId)?.name ?? ""} tone={i} />)}
          </div>
        )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
