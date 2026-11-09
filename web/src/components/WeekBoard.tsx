import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isVisible, useHang, YOU } from "../lib/hangouts";
import { fromYmd, useReminders } from "../lib/reminders";
import { useSpace } from "../lib/roommates";
import { classesOn, clockLabel, toMinutes, useClasses } from "../lib/classes";
import { useCampusEvents } from "../lib/campusEvents";

const ROW = 56; // px per hour
const LONG_EVENT = 300; // minutes: an event at least this long is shown as "all day"
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 || h === 24 ? "AM" : "PM"}`;
const clock = (m: number) => { const h = Math.floor(m / 60) % 24, mm = m % 60; return `${h % 12 || 12}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

type Mark = "pending" | "yes" | "no";
type Block = { id: string; kind: "hangout" | "reminder" | "class" | "event" | "group"; title: string; place?: string; start: number; len: number; mark?: Mark; done?: boolean; going?: string[]; lane: number; lanes: number; /** For a group: the things happening at once, listed in one block. */ items?: Block[] };
type Chip = { id: string; kind: "chore" | "reminder" | "event"; title: string; done: boolean; hint?: string };

/** Side-by-side lanes for events that overlap in time, so none hides another. */
function layout(list: Omit<Block, "lane" | "lanes">[]): Block[] {
  const sorted = [...list].sort((a, b) => a.start - b.start || b.len - a.len);
  const out: Block[] = [];
  let cluster: Block[] = [], clusterEnd = -1;
  const close = () => {
    const n = Math.max(1, ...cluster.map((b) => b.lane + 1));
    if (n >= 3) {
      // Three or more at once cannot sit side by side in a narrow column and still be read, so they become one block that lists them.
      const begin = Math.min(...cluster.map((b) => b.start)), end = Math.max(...cluster.map((b) => b.start + b.len));
      const items = [...cluster].sort((a, b) => a.start - b.start).map((b) => ({ ...b, lane: 0, lanes: 1 }));
      out.push({ id: `group-${cluster[0].id}`, kind: "group", title: `${cluster.length} at the same time`, start: begin, len: end - begin, lane: 0, lanes: 1, items, mark: items.some((b) => b.mark === "pending") ? "pending" : undefined });
    } else { cluster.forEach((b) => { b.lanes = n; }); out.push(...cluster); }
    cluster = [];
  };
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

/** Everything on the schedule, with the things inside a group counted one by one. */
const flat = (list: Block[]) => list.flatMap((b) => b.items ?? [b]);

/** A week (or one day) laid out by the hour, like a paper planner. Hangouts are tinted by your answer; reminders and chores sit beside them. */
export default function WeekBoard({ day, onDay }: { day: string | null; onDay: (key: string | null) => void }) {
  const { groups, hangouts } = useHang();
  const reminders = useReminders();
  const space = useSpace();
  const classes = useClasses();
  const campus = useCampusEvents().events;
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
    for (const c of campus) {
      if (c.canceled || c.status !== "published") continue;
      const s = new Date(c.startsAt);
      const len = c.endsAt ? Math.max(30, Math.round((new Date(c.endsAt).getTime() - s.getTime()) / 60000)) : 90;
      // An event that runs most of the day (or all of it) goes in the "All day" strip. As a tall block in the hour grid it would crowd out everything beside it.
      if (len >= LONG_EVENT) { put(chips, s.toDateString(), { id: `ce-${c.id}`, kind: "event", title: c.title, done: false, hint: `${c.title}${c.place ? `, ${c.place}` : ""}` }); continue; }
      put(raw, s.toDateString(), { id: `ce-${c.id}`, kind: "event", title: c.title, place: `${c.kind === "official" ? "Official" : "Student event"}${c.place ? ` · ${c.place}` : ""}`, start: minutesOf(s), len: Math.min(len, 600), mark: c.mine === "going" ? "yes" : undefined, going: undefined });
    }
    for (const t of space?.tasks ?? []) if (t.due && t.assignee === YOU) put(chips, fromYmd(t.due).toDateString(), { id: t.id, kind: "chore", title: t.title, done: t.done });
    const blocks = new Map<string, Block[]>();
    raw.forEach((list, k) => blocks.set(k, layout(list)));
    return { blocks, chips };
  }, [hangouts, groups, reminders, space, classes, campus, view, anchor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show every event in view: start at 8 AM unless something is earlier, end at 9 PM unless something runs later.
  const shown = days.flatMap((d) => blocks.get(d.toDateString()) ?? []);
  const everything = flat(shown);
  const FIRST = Math.max(0, Math.min(8, ...shown.map((b) => Math.floor(b.start / 60))));
  const LAST = Math.min(23, Math.max(21, ...shown.map((b) => Math.ceil((b.start + b.len) / 60))));
  const hours = Array.from({ length: LAST - FIRST + 1 }, (_, i) => FIRST + i);

  // Open near the current hour so today is in view without scrolling.
  useEffect(() => {
    const el = scroller.current;
    const earliest = shown.length ? Math.min(...shown.map((b) => Math.floor(b.start / 60))) : now.getHours();
    if (el) el.scrollTop = Math.max(0, (Math.min(earliest, now.getHours()) - FIRST - 1) * ROW);
  }, [view, FIRST]); // eslint-disable-line react-hooks/exhaustive-deps

  const first = days[0], last = days[days.length - 1];
  const title = view === "day"
    ? first.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    : `${first.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${last.toLocaleDateString(undefined, { month: first.getMonth() === last.getMonth() ? undefined : "short", day: "numeric" })}, ${last.getFullYear()}`;
  const go = (n: number) => setAnchor((a) => addDays(a, n));
  const hasChips = days.some((d) => chips.has(d.toDateString()));
  const cols = { gridTemplateColumns: `52px repeat(${days.length}, minmax(0,1fr))` };

  const counts = days.map((d) => flat(blocks.get(d.toDateString()) ?? []).length + (chips.get(d.toDateString()) ?? []).filter((c) => c.kind === "event").length);
  const allDayEvents = days.reduce((n, d) => n + (chips.get(d.toDateString()) ?? []).filter((c) => c.kind === "event").length, 0);

  return (
    <section className="wb" aria-label="Schedule">
      <header className="wb-head">
        <div>
          <h2>{title}</h2>
          <p className="wb-sub">{everything.length + allDayEvents === 0 ? "Nothing planned" : `${everything.length + allDayEvents} thing${everything.length + allDayEvents === 1 ? "" : "s"} on the schedule`}{everything.some((b) => b.mark === "pending") ? ` · ${everything.filter((b) => b.mark === "pending").length} need your answer` : ""}</p>
        </div>
        <div className="wb-ctl">
          <button type="button" className="wb-today" onClick={() => { setAnchor(new Date()); onDay(new Date().toDateString()); }}>Today</button>
          <button type="button" className="wb-arrow" aria-label={view === "week" ? "Previous week" : "Previous day"} onClick={() => go(-step)}><ChevronLeft size={18} /></button>
          <button type="button" className="wb-arrow" aria-label={view === "week" ? "Next week" : "Next day"} onClick={() => go(step)}><ChevronRight size={18} /></button>
        </div>
      </header>

      <div className="wb-card">
        <ul className="wb-legend" aria-label="What the blocks mean">
          <li><i className="lg hangout" aria-hidden="true" /> Plan</li>
          <li><i className="lg pending" aria-hidden="true" /> Waiting for your answer</li>
          <li><i className="lg other" aria-hidden="true" /> Class, event or reminder</li>
        </ul>
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
                {(chips.get(d.toDateString()) ?? []).map((c) => <span key={c.id} className={`wb-chip ${c.kind}` + (c.done ? " done" : "")} title={c.hint ?? c.title}>{c.title}</span>)}
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
                    if (b.items) {
                      // Several things at once: one block that lists them, tall enough for every line.
                      const gh = Math.max(h, b.items.length * 24 + 12);
                      return (
                        <button key={b.id} type="button" className={"wb-ev group" + (b.mark ? ` m-${b.mark}` : "")} style={{ top, height: gh, ["--h" as string]: `${gh}px`, left: "3px", width: "calc(100% - 6px)" }}
                          onClick={() => onDay(k)} aria-label={`${b.items.length} things at the same time: ${b.items.map((x) => `${x.title}, ${clock(x.start)}`).join("; ")}`}>
                          <ul>{b.items.map((x) => <li key={x.id} className={x.mark ? `m-${x.mark}` : undefined}><span>{clock(x.start).replace(":00", "").replace(" ", "").toLowerCase()}</span><strong>{x.title}</strong></li>)}</ul>
                        </button>
                      );
                    }
                    return (
                      <button key={b.id} type="button" className={`wb-ev ${b.kind}` + (b.mark ? ` m-${b.mark}` : "") + (b.done ? " done" : "") + (compact ? " compact" : "") + (b.lanes >= 3 ? " tight" : "")}
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
