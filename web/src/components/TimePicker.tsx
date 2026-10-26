import Picker from "./Picker";

const HOURS = Array.from({ length: 12 }, (_, i) => { const h = String(i + 1); return { value: h, label: h }; });
const MINUTES = Array.from({ length: 60 }, (_, i) => { const m = String(i).padStart(2, "0"); return { value: m, label: m }; }); // every minute

/** "15:30" to the parts people read: 3, 30, PM. */
export function parts(value: string) {
  const [h, m] = (value || "09:00").split(":").map(Number);
  return { hour: String(h % 12 === 0 ? 12 : h % 12), minute: String(m).padStart(2, "0"), pm: h >= 12 };
}

/** Back to the 24 hour "HH:MM" that reminders store. */
export function to24(hour: string, minute: string, pm: boolean) {
  const h = (Number(hour) % 12) + (pm ? 12 : 0);
  return `${String(h).padStart(2, "0")}:${minute}`;
}

/** A time picker in the app's own style: hour, minute and AM or PM. Value is "HH:MM". */
export default function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { hour, minute, pm } = parts(value);
  return (
    <div className="timepick" role="group" aria-label="Time">
      <Picker narrow compact value={hour} options={HOURS} onChange={(h) => onChange(to24(h, minute, pm))} label="Hour" />
      <span className="timepick-colon" aria-hidden="true">:</span>
      <Picker narrow compact value={minute} options={MINUTES} onChange={(m) => onChange(to24(hour, m, pm))} label="Minute" />
      <div className="segment" role="radiogroup" aria-label="AM or PM">
        <button type="button" role="radio" aria-checked={!pm} onClick={() => onChange(to24(hour, minute, false))}>AM</button>
        <button type="button" role="radio" aria-checked={pm} onClick={() => onChange(to24(hour, minute, true))}>PM</button>
      </div>
    </div>
  );
}
