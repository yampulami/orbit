import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bell, Check, Plus, Trash2 } from "lucide-react";
import { QUICK_TIMES, fromYmd, reminderActions, useReminders, ymd } from "../lib/reminders";
import PinButton from "./PinButton";
import { notice } from "../lib/notice";
import TimePicker from "./TimePicker";
import { deviceAlertsOn, deviceSupported, devicePermission, enableDeviceAlerts } from "../lib/deviceAlerts";

const clock = (t: string) => new Date(`2000-01-01T${t}`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** The reminders for one calendar day: what is set, and a quick way to add one. `day` is a Date.toDateString() key. */
export default function RemindersPanel({ day }: { day: string }) {
  const all = useReminders();
  const [title, setTitle] = useState("");
  const [pick, setPick] = useState<string>(""); // "" = any time, "custom", or a quick time value
  const [custom, setCustom] = useState("");
  // The time choices stay open once you start (not only while a field has focus: tapping a menu item moves focus away, which used to close
  // everything before the tap landed). They close when you tap outside with nothing typed or chosen.
  const [started, setStarted] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!started) return;
    const away = (e: PointerEvent) => { if (!form.current?.contains(e.target as Node) && !title.trim() && pick === "") setStarted(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [started, title, pick]);

  const mine = all.filter((r) => fromYmd(r.date).toDateString() === day).sort((a, b) => Number(a.done) - Number(b.done) || (a.time ?? "").localeCompare(b.time ?? ""));
  const open = mine.filter((r) => !r.done).length;
  const label = new Date(day).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = pick === "custom" ? custom : pick;

  function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const date = ymd(new Date(day));
    if (all.some((r) => !r.done && r.date === date && (r.time ?? "") === (time || "") && r.title.trim().toLowerCase() === title.trim().toLowerCase())) {
      notice.show({ icon: "calendar", title: "You already set that", message: `"${title.trim()}" is already on this day${time ? " at that time" : ""}. Change the wording or the time to add another.` });
      return;
    }
    if (time && new Date(`${date}T${time}`).getTime() < Date.now()) notice.show({ icon: "calendar", title: "That time has passed", message: "I saved it, but it will not alert you because the time is already behind us.", ms: 5000 });
    reminderActions.add(title.trim(), date, time || undefined);
    // A reminder with a time is only useful if it can reach you: offer the device alert the first time.
    if (time && deviceSupported() && !deviceAlertsOn() && devicePermission() === "default") {
      notice.show({
        icon: "calendar", title: "Get this as a device alert?", message: "Orbit can show a notification in the corner of your screen when a reminder is due.", ms: 15000,
        actions: [{ label: "Turn on alerts", onClick: () => { void enableDeviceAlerts(); } }],
      });
    }
    setTitle(""); setPick(""); setCustom(""); setStarted(false);
  }

  return (
    <div className="cal-rem">
      <h3><Bell size={15} aria-hidden="true" />Reminders · {label}{open > 0 && <span className="rem-count">{open}</span>}</h3>

      {mine.length === 0 ? (
        <p className="rem-empty">Nothing set for this day.</p>
      ) : (
        <ul>
          {mine.map((r) => (
            <li key={r.id} className={r.done ? "done" : ""}>
              <button type="button" className="check" role="checkbox" aria-checked={r.done} aria-label={`${r.done ? "Mark not done" : "Mark done"}: ${r.title}`} onClick={() => reminderActions.setDone(r.id, !r.done)}><Check size={14} strokeWidth={2.4} aria-hidden="true" /></button>
              <span className="rem-title">{r.title}</span>
              {!r.done && <PinButton kind="reminder" id={r.id} title={r.title} />}
              <span className="rem-time">{r.time ? clock(r.time) : "Morning"}</span>
              <button type="button" className="ghost-btn" aria-label={`Delete reminder ${r.title}`} onClick={() => reminderActions.remove(r.id)}><Trash2 size={15} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      )}

      <form ref={form} onSubmit={add} onFocus={() => setStarted(true)} onPointerDown={() => setStarted(true)} className={title.trim() || started || pick !== "" ? "has-text" : undefined}>
        <div className="rem-row">
          <label className="field"><span className="sr">Reminder</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Remind me to…" maxLength={80} /></label>
          <button className="btn primary" disabled={!title.trim()}><Plus size={16} aria-hidden="true" />Add</button>
        </div>
        <div className="rem-more"><div>
        <div className="rem-times" role="radiogroup" aria-label="When to remind you">
          <button type="button" role="radio" aria-checked={pick === ""} onClick={() => setPick("")}>Morning</button>
          {QUICK_TIMES.map((q) => <button key={q.value} type="button" role="radio" aria-checked={pick === q.value} onClick={() => setPick(q.value)}>{q.label}</button>)}
          <button type="button" role="radio" aria-checked={pick === "custom"} onClick={() => { setPick("custom"); setCustom((c) => c || "09:00"); }}>Pick time</button>
        </div>
        {pick === "custom" && <TimePicker value={custom} onChange={setCustom} />}
        </div></div>
      </form>
    </div>
  );
}
