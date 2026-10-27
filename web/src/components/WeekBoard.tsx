import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isVisible, useHang, YOU } from "../lib/hangouts";
import { fromYmd, useReminders } from "../lib/reminders";
import { useSpace } from "../lib/roommates";
import { classesOn, clockLabel, toMinutes, useClasses } from "../lib/classes";

const ROW = 56; // px per hour
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 || h === 24 ? "AM" : "PM"}`;
const clock = (m: number) => { const h = Math.floor(m / 60) % 24, mm = m % 60; return `${h % 12 || 12}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

type Mark = "pending" | "yes" | "no";
type Block = { id: string; kind: "hangout" | "reminder" | "class"; title: string; place?: string; start: number; len: number; mark?: Mark; done?: boolean; going?: string[]; lane: number; lanes: number };
type Chip = { id: string; kind: "chore" | "reminder"; title: string; done: boolean };

/** Side-by-side lanes for events that overlap in time, so none hides another. */
function layout(list: Omit<Block, "lane" | "lanes">[]): Block[] {
  const sorted = [...list].sort((a, b) => a.start - b.start || b.len - a.len);
  const out: Block[] = [];
  let cluster: Block[] = [], clusterEnd = -1;
  const close = () => { const n = Math.max(1, ...cluster.map((b) => b.lane + 1)); cluster.forEach((b) => { b.lanes = n; }); out.push(...cluster); cluster = []; };
  for (const e of sorted) {
    if (cluster.length && e.start >= clusterEnd) close();
    const taken = new Set(cluster.filter((b) => b.start + b.len > e.start).map((b) => b.lane));
    let lane = 0; while (taken.has(lane)) lane++;
    cluster.push({ ...e, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, e.start + e.len);
  }
  close();
  return out;
}

/** A week (or one day) laid out by the hour, like a paper planner. Hangouts are tinted by your answer; reminders and chores sit beside them. */
export default function WeekBoard({ day, onDay }: { day: string | null; onDay: (key: string | null) => void }) {
  const { groups, hangouts } = useHang();
  const reminders = useReminders();
  const space = useSpace();
  const classes = useClasses();
  const [view, setView] = useState<"week" | "day">("week");
  const [anchor, setAnchor] = useState(() => (day ? new Date(day) : new Date()));
  const [now, setNow] = useState(() => new Date());
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => { if (day) setAnchor(new Date(day)); }, [day]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);

  const start = view === "week" ? addDays(anchor, -((anchor.getDay() + 6) % 7)) : new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const days = Array.from({ length: view === "week" ? 7 : 1 }, (_, i) => addDays(start, i));
  const todayKey = now.toDateString();
  const step = view === "week" ? 7 : 1;

  const { blocks, chips } = useMemo(() => {
    const raw = new Map<string, Omit<Block, "lane" | "lanes">[]>(), chips = new Map<string, Chip[]>();
    const put = <T,>(m: Map<string, T[]>, k: string, v: T) => m.set(k, [...(m.get(k) ?? []), v]);
    for (const h of hangouts) {
      if (!isVisible(h, groups)) continue;
      const w = new Date(h.when);
      put(raw, w.toDateString(), { id: h.id, kind: "hangout", title: h.title, place: h.place, start: minutesOf(w), len: h.len ?? 90, mark: h.rsvps[YOU] ?? "pending", going: Object.entries(h.rsvps).filter(([, v]) => v === "yes").map(([n]) => n) });
    }
    for (const r of reminders) {
      const d = fromYmd(r.date);
      if (r.time) {
        const [hh, mm] = r.time.split(":").map(Number);
        put(raw, d.toDateString(), { id: r.id, kind: "reminder", title: r.title, start: hh * 60 + mm, len: 40, done: r.done });
      } else put(chips, d.toDateString(), { id: r.id, kind: "reminder", title: r.title, done: r.done });
    }
    for (const d of days) {
      for (const c of classesOn(classes, d)) put(raw, d.toDateString(), { id: `${c.id}-${d.toDateString()}`, kind: "class", title: c.name, place: c.place, start: toMinutes(c.start), len: toMinutes(c.end) - toMinutes(c.start) });
    }
    for (const t of space?.tasks ?? []) if (t.due && t.assignee === YOU) put(chips, fromYmd(t.due).toDateString(), { id: t.id, kind: "chore", title: t.title, done: t.done });
    const blocks = new Map<string, Block[]>();
    raw.forEach((list, k) => blocks.set(k, layout(list)));
    return { blocks, chips };
  }, [hangouts, groups, reminders, space, classes, view, anchor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show every event in view: start at 8 AM unless something is earlier, end at 9 PM unless something runs later.
  const shown = days.flatMap((d) => blocks.get(d.toDateString()) ?? []);
  const FIRST = Math.max(0, Math.min(8, ...shown.map((b) => Math.floor(b.start / 60))));
  const LAST = Math.min(23, Math.max(21, ...shown.map((b) => Math.ceil((b.start + b.len) / 60))));
  const hours = Array.from({ length: LAST - FIRST + 1 }, (_, i) => FIRST + i);

  // Open near the current hour so today is in view without scrolling.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = Math.max(0, (now.getHours() - FIRST - 1) * ROW);
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  const first = days[0], last = days[days.length - 1];
  const title = view === "day"
    ? first.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    : `${first.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${last.toLocaleDateString(undefined, { month: first.getMonth() === last.getMonth() ? undefined : "short", day: "numeric" })}, ${last.getFullYear()}`;
  const go = (n: number) => setAnchor((a) => addDays(a, n));
  const hasChips = days.some((d) => chips.has(d.toDateString()));
  const cols = { gridTemplateColumns: `52px repeat(${days.length}, minmax(0,1fr))` };

  const counts = days.map((d) => (blocks.get(d.toDateString()) ?? []).length);

  return (
    <section className="wb" aria-label="Schedule">
      <header className="wb-head">
        <div>
          <h2>{title}</h2>
          <p className="wb-sub">{shown.length === 0 ? "Nothing planned" : `${shown.length} thing${shown.length === 1 ? "" : "s"} on the schedule`}{shown.some((b) => b.mark === "pending") ? ` · ${shown.filter((b) => b.mark === "pending").length} need your answer` : ""}</p>
        </div>
        <div className="wb-ctl">
          <div className="segment" role="radiogroup" aria-label="Schedule view">
            {(["day", "week"] as const).map((v) => <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)}>{v === "day" ? "Day" : "Week"}</button>)}
          </div>
          <button type="button" className="wb-today" onClick={() => { setAnchor(new Date()); onDay(new Date().toDateString()); }}>Today</button>
          <button type="button" className="wb-arrow" aria-label={view === "week" ? "Previous week" : "Previous day"} onClick={() => go(-step)}><ChevronLeft size={18} /></button>
          <button type="button" className="wb-arrow" aria-label={view === "week" ? "Next week" : "Next day"} onClick={() => go(step)}><ChevronRight size={18} /></button>
        </div>
      </header>

      <div className="wb-card">
        <div className="wb-cols" style={cols}>
          <span />
          {days.map((d, i) => {
            const k = d.toDateString();
            return (
              <button key={k} type="button" className={"wb-dh" + (k === todayKey ? " today" : "") + (k === day ? " sel" : "")} aria-pressed={k === day} onClick={() => onDay(k === day ? null : k)}>
                <b>{String(d.getDate()).padStart(2, "0")}</b>
                <span>{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
                <i className="wb-dots" aria-hidden="true">{Array.from({ length: Math.min(3, counts[i]) }, (_, n) => <u key={n} />)}</i>
              </button>
            );
          })}
        </div>
        {hasChips && (
          <div className="wb-cols wb-allday" style={cols}>
            <span className="wb-hr">All day</span>
            {days.map((d) => (
              <div key={d.toDateString()}>
                {(chips.get(d.toDateString()) ?? []).map((c) => <span key={c.id} className={`wb-chip ${c.kind}` + (c.done ? " done" : "")} title={c.title}>{c.title}</span>)}
              </div>
            ))}
          </div>
        )}
        <div className="wb-scroll" ref={scroller} tabIndex={0} aria-label="Hours">
          <div className="wb-body" style={{ height: hours.length * ROW, ...cols }}>
            <div className="wb-hours">{hours.map((h) => <span key={h} style={{ top: (h - FIRST) * ROW }}>{hourLabel(h)}</span>)}</div>
            {days.map((d) => {
              const k = d.toDateString();
              const isToday = k === todayKey;
              const nowTop = ((minutesOf(now) - FIRST * 60) / 60) * ROW;
              return (
                <div key={k} className={"wb-day" + (isToday ? " today" : "") + (d.getDay() % 6 === 0 ? " weekend" : "")} style={{ backgroundSize: `100% ${ROW}px` }}>
                  {isToday && nowTop > 0 && <i className="wb-past" style={{ height: Math.min(nowTop, hours.length * ROW) }} aria-hidden="true" />}
                  {(blocks.get(k) ?? []).map((b) => {
                    const top = ((b.start - FIRST * 60) / 60) * ROW + 2;
                    const h = Math.max(44, (b.len / 60) * ROW - 4);
                    const compact = h < 56;
                    return (
                      <button key={b.id} type="button" className={`wb-ev ${b.kind}` + (b.mark ? ` m-${b.mark}` : "") + (b.done ? " done" : "") + (compact ? " compact" : "")}
                        style={{ top, height: h, ["--h" as string]: `${h}px`, left: `calc(${(b.lane / b.lanes) * 100}% + 3px)`, width: `calc(${100 / b.lanes}% - 6px)` }}
                        onClick={() => onDay(k)}
                        title={`${b.title}, ${clock(b.start)}${b.place ? `, ${b.place}` : ""}`}>
                        <strong>{b.title}</strong>
                        <span>{clock(b.start)}{!compact && b.place ? ` · ${b.place}` : ""}</span>
                        {!compact && b.going && <em>{b.going.length} going</em>}
                      </button>
                    );
                  })}
                  {isToday && nowTop >= 0 && nowTop <= hours.length * ROW && <i className="wb-now" style={{ top: nowTop }} aria-hidden="true" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
