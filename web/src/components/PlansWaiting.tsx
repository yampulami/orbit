import { useState } from "react";
import { hangActions, isVisible, useHang, YOU, type Hangout } from "../lib/hangouts";
import { useMyBusy } from "../lib/useMyBusy";
import { busyOn } from "../lib/myBusy";
import { undo } from "../lib/undo";
import { clock, dayWord } from "../lib/dayWords";

const HOUR = 3600000;

function Row({ h, group, clash }: { h: Hangout; group: string; clash: string }) {
  const d = new Date(h.when);
  const yes = Object.values(h.rsvps).filter((a) => a === "yes").length;
  const answer = (a: "yes" | "no") => {
    hangActions.setRsvp(h.id, a);
    undo.show(a === "yes" ? `You’re in for “${h.title}”` : `You said you can’t make “${h.title}”`, { onUndo: () => hangActions.setRsvp(h.id, null), commit: () => {} });
  };
  return (
    <li className="pw-row">
      <div className="pw-when"><b>{dayWord(d)}</b><span>{clock(d)}</span></div>
      <div className="pw-what">
        <h3>{h.title}</h3>
        <p>{[h.by === YOU ? "You planned this" : `${h.by} planned this`, h.place, group, yes > 0 ? `${yes} going` : ""].filter(Boolean).join(" · ")}</p>
        {clash && <p className="pw-clash">Overlaps {clash}</p>}
      </div>
      <div className="pw-ans" role="group" aria-label={`Are you going to ${h.title}?`}>
        <button type="button" className="btn primary" onClick={() => answer("yes")}>I’m in</button>
        <button type="button" className="btn" onClick={() => answer("no")}>Can’t</button>
      </div>
    </li>
  );
}

/** Plans your friends made that are waiting on your answer. Nothing shows when nothing needs you, and a plan you already answered is never repeated here
 *  (the "Now" header above already says what is next). */
export default function PlansWaiting() {
  const { groups, hangouts } = useHang();
  const { input } = useMyBusy(new Date());
  const [all, setAll] = useState(false);
  const asking = hangouts
    .filter((h) => isVisible(h, groups) && !h.canceled && new Date(h.when).getTime() > Date.now() - 3 * HOUR && !h.rsvps[YOU])
    .sort((a, b) => a.when.localeCompare(b.when));
  if (asking.length === 0) return null;
  const shown = all ? asking : asking.slice(0, 3);
  const groupName = (h: Hangout) => groups.find((g) => g.id === h.groupId)?.name ?? "";
  // A plan that lands on one of your classes says so before you answer.
  const clashWith = (h: Hangout) => {
    const start = new Date(h.when), end = new Date(start.getTime() + HOUR);
    const c = busyOn(input, start).find((i) => i.kind === "class" && i.start < end && i.end > start);
    return c ? `${c.label} at ${clock(c.start)}` : "";
  };
  return (
    <section className="pw" aria-label="Hangouts">
      <h2 className="pw-h">Plans waiting on you</h2>
      <ul className="pw-list">{shown.map((h) => <Row key={h.id} h={h} group={groupName(h)} clash={clashWith(h)} />)}</ul>
      {asking.length > 3 && <button type="button" className="text-btn" aria-expanded={all} onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `${asking.length - 3} more waiting`}</button>}
      <p className="pw-note">The people in each plan see your answer.</p>
    </section>
  );
}
