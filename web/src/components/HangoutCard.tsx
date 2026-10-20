import { motion } from "framer-motion";
import { Check, MapPin, X } from "lucide-react";
import { undo } from "../lib/undo";
import { slide } from "../lib/motion";
import { progress, useProgress } from "../lib/progress";
import { hangActions, YOU, type Hangout } from "../lib/hangouts";

export const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
};

/** A planned hangout with a Yes / No answer for the current person. */
export default function HangoutCard({ h, group, tone = 0, plain = false }: { h: Hangout; group: string; tone?: number; plain?: boolean }) {
  const mine = h.rsvps[YOU];
  const { enabled, checkins } = useProgress();
  const past = new Date(h.when).getTime() < Date.now();
  const went = checkins.includes(h.id);
  const going = Object.entries(h.rsvps).filter(([, a]) => a === "yes").map(([n]) => n);
  const cancel = () => {
    hangActions.setCanceled(h.id, true);
    undo.show(`“${h.title}” canceled`, { onUndo: () => hangActions.setCanceled(h.id, false), commit: () => {} });
  };
  const answer = (a: "yes" | "no") => hangActions.setRsvp(h.id, mine === a ? null : a);

  return (
    <article className={"hang" + (plain ? " plain" : "")} data-tone={tone % 5}>
      <div className="hang-top"><span className="chip">{group}</span><span className="hang-when">{fmtWhen(h.when)}</span></div>
      <h3>{h.title}</h3>
      <p className="hang-place"><MapPin size={16} strokeWidth={1.75} aria-hidden="true" />{h.place}</p>
      <div className="hang-meta">
        <p className="hang-by">Planned by {h.by === YOU ? "you" : h.by}</p>
        {h.by === YOU && !past && <button type="button" className="hang-x" aria-label={`Cancel ${h.title}`} onClick={cancel}><X size={14} strokeWidth={2.2} aria-hidden="true" />Cancel</button>}
      </div>
      {enabled && past && (mine === "yes"
        ? (went
          ? <span className="hang-went"><Check size={16} strokeWidth={2} />You went</span>
          : <button type="button" className="hang-went btn" onClick={() => progress.checkIn(h.id)}>I went</button>)
        : <span className="hang-went ghost" aria-hidden="true">I went</span>)}
      <div className="hang-foot">
        <div className="hang-people">
          {going.length > 0 && <span className="avatars" aria-hidden="true">{going.slice(0, 4).map((n) => <span key={n}>{n.slice(0, 1).toUpperCase()}</span>)}</span>}
          <span className="hang-count">{going.length} going</span>
        </div>
        <div className="rsvp" role="group" aria-label={`Are you going to ${h.title}?`}>
          {(["yes", "no"] as const).map((a) => (
            <motion.button key={a} type="button" data-a={a} aria-pressed={mine === a} whileTap={{ scale: 0.94 }} onClick={() => answer(a)}>
              {mine === a && <motion.span layoutId={`thumb-${h.id}`} className="thumb" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={slide} />}
              <span>{a === "yes" ? "Yes" : "No"}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </article>
  );
}
