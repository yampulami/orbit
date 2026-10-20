import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import HangoutCard from "./HangoutCard";
import { useHang, YOU, type Hangout } from "../lib/hangouts";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

type Mark = "pending" | "no" | "yes";
const markOf = (h: Hangout): Mark => h.rsvps[YOU] ?? "pending";
const MARK_TEXT: Record<Mark, string> = { pending: "needs your answer", no: "you are not going", yes: "you are all set" };
/** One color per day: unanswered first, then going, then not going. */
const dayMark = (hs: Hangout[]): Mark | undefined => {
  const marks = hs.map(markOf);
  return (["pending", "yes", "no"] as const).find((m) => marks.includes(m));
};

/** Month grid. Dots mark days with posts; tinted days have hangouts. `day` is a Date.toDateString() key. */
export default function Calendar({ posts, day, onDay }: {
  posts: { created_at: string }[];
  day: string | null;
  onDay: (key: string | null) => void;
}) {
  const { groups, hangouts } = useHang();
  const [month, setMonth] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const view = new Date(today.getFullYear(), today.getMonth() + month, 1);
  const lead = view.getDay();
  const total = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((lead + total) / 7) * 7 }, (_, k) => new Date(view.getFullYear(), view.getMonth(), k - lead + 1));
  const withPosts = new Set(posts.map((p) => new Date(p.created_at).toDateString()));

  // Hangouts by day. A past hangout nobody answered no longer asks for attention.
  const byDay = new Map<string, Hangout[]>();
  for (const h of hangouts) {
    if (h.canceled || !groups.some((g) => g.id === h.groupId)) continue;
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
          const cls = ["cal-day", d.getMonth() !== view.getMonth() ? "out" : "", withPosts.has(key) ? "has" : "", key === today.toDateString() ? "today" : "", mark ? `hm-${mark}` : "", key === day ? "sel" : ""].join(" ");
          const label = d.toLocaleDateString(undefined, { dateStyle: "full" }) + (mark ? `, hangout: ${MARK_TEXT[mark]}` : "");
          return <button key={key} type="button" data-key={key} tabIndex={key === stop ? 0 : -1} className={cls} aria-pressed={key === day} aria-label={label} title={mark ? MARK_TEXT[mark] : undefined} onClick={() => onDay(key === day ? null : key)}>{d.getDate()}</button>;
        })}
      </div>
      {chosen.length > 0 && (
        <div className="cal-hangs">
          {chosen.map((h, i) => <HangoutCard key={h.id} h={h} group={groups.find((g) => g.id === h.groupId)?.name ?? ""} tone={i} />)}
        </div>
      )}
    </section>
  );
}
