import { Check } from "lucide-react";
import { TENURE_LABEL, homeLine, interestsLine, stepNote } from "../lib/setupPreview";
import { placeOf, type University } from "../lib/universities";
import type { Living, Tenure } from "../lib/profile";

/** "Your Orbit so far": a card beside the setup questions that fills in as you answer, saying what Orbit will do with each answer.
 *  It is a plain, still summary: nothing here is a placeholder for later, every line is true of the app. */
export default function SetupPreview({ step, uni, name, username, tenure, living, interests }: {
  step: "campus" | "you" | "life" | "interests"; uni: University | null; name: string; username: string; tenure: Tenure | ""; living: Living | null; interests: string[];
}) {
  const first = name.trim().split(" ")[0] ?? "";
  const rows: { key: string; label: string; done: boolean; text: string }[] = [
    { key: "campus", label: "Campus", done: !!uni, text: uni ? `${uni.name}${placeOf(uni) ? `, ${placeOf(uni)}` : ""}` : "Not chosen yet" },
    { key: "home", label: "Home", done: !!living, text: homeLine(living) },
    { key: "standing", label: "Standing", done: !!tenure, text: tenure ? `${TENURE_LABEL[tenure]}. Only you see this.` : "Only you will see this." },
    { key: "interests", label: "Interests", done: interests.length > 0, text: interestsLine(interests) },
  ];
  return (
    <aside className="sp" aria-label="Your Orbit so far">
      <p className="sp-k">Your Orbit so far</p>
      <div className="sp-who">
        <span className="sp-av" aria-hidden="true">{first ? first.slice(0, 1).toUpperCase() : "?"}</span>
        <div><strong>{first || "Your name"}</strong><em>{username ? `@${username}` : "@username"}</em></div>
      </div>
      <dl className="sp-rows">
        {rows.map((r) => (
          <div key={r.key} className={r.done ? "done" : undefined}>
            <dt><span className="sp-tick" aria-hidden="true">{r.done && <Check size={12} strokeWidth={3} />}</span>{r.label}</dt>
            <dd>{r.text}</dd>
          </div>
        ))}
      </dl>
      <p className="sp-note">{stepNote(step, uni?.name)}</p>
    </aside>
  );
}
