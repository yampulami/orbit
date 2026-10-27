import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { defaultTime, describe, fromValue, monthGrid, toValue, ymdOf } from "../lib/dateTime";
import TimePicker from "./TimePicker";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** A date and time field in the app's own look: a button that opens a month calendar and a time picker (hour, every minute, AM or PM).
 *  `value` and `min` are "YYYY-MM-DDTHH:MM" in local time. Days before `min` cannot be picked. */
export default function DateTimeField({ label, value, onChange, min, optional, placeholder = "Pick a date and time" }: {
  label: string; value: string; onChange: (v: string) => void; min?: string; optional?: boolean; placeholder?: string;
}) {
  const parsed = fromValue(value);
  const minDate = fromValue(min ?? "")?.date;
  const [open, setOpen] = useState(false);
  const start = parsed ? new Date(`${parsed.date}T12:00`) : minDate ? new Date(`${minDate}T12:00`) : new Date();
  const [view, setView] = useState({ y: start.getFullYear(), m: start.getMonth() });
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const today = ymdOf(new Date());

  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const weeks = monthGrid(view.y, view.m);
  const monthLabel = new Date(view.y, view.m, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const shift = (n: number) => setView((v) => { const d = new Date(v.y, v.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const pickDate = (date: string) => onChange(toValue(date, parsed?.time ?? defaultTime(date)));
  const disabled = (date: string) => !!minDate && date < minDate;

  return (
    <div className="field dtf" ref={root}>
      <span id={`${id}-l`}>{label}</span>
      <button type="button" className={"dtf-btn" + (parsed ? "" : " empty")} aria-haspopup="dialog" aria-expanded={open} aria-labelledby={`${id}-l ${id}-b`} onClick={() => setOpen((v) => !v)}>
        <span id={`${id}-b`}>{describe(value) || placeholder}</span>
        <CalendarDays size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className="dtf-pop" role="dialog" aria-label={`Choose ${label.toLowerCase()}`}>
          <div className="dtf-head">
            <button type="button" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft size={18} aria-hidden="true" /></button>
            <strong>{monthLabel}</strong>
            <button type="button" aria-label="Next month" onClick={() => shift(1)}><ChevronRight size={18} aria-hidden="true" /></button>
          </div>
          <div className="dtf-week" aria-hidden="true">{WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="dtf-grid" role="grid" aria-label={monthLabel}>
            {weeks.flat().map((c) => (
              <button key={c.date} type="button" role="gridcell" disabled={disabled(c.date)} aria-pressed={parsed?.date === c.date} aria-current={c.date === today ? "date" : undefined}
                className={(c.inMonth ? "" : "out ") + (c.date === today ? "today " : "") + (parsed?.date === c.date ? "on" : "")} onClick={() => pickDate(c.date)}>{Number(c.date.slice(8))}</button>
            ))}
          </div>
          <div className="dtf-time">
            <span>Time</span>
            <TimePicker value={parsed?.time ?? "09:00"} onChange={(t) => onChange(toValue(parsed?.date ?? (minDate && minDate > today ? minDate : today), t))} />
          </div>
          <div className="dtf-foot">
            {optional && value ? <button type="button" className="link-btn" onClick={() => { onChange(""); setOpen(false); }}><X size={14} aria-hidden="true" /> Clear</button> : <button type="button" className="link-btn" onClick={() => { const d = disabled(today) ? minDate! : today; setView({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)) - 1 }); pickDate(d); }}>Today</button>}
            <button type="button" className="btn primary" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
