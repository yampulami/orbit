import { YOU } from "../../lib/hangouts";
import { workload, type Space } from "../../lib/roommates";
import { Avatar } from "./Avatar";

/** Shows how chore effort is spread, without ranking anyone. People are listed in household order, not by score. */
export default function Fairness({ space }: { space: Space }) {
  const w = workload(space.members, space.tasks);
  const rows = space.members.map((m) => ({ m, ...w[m] }));
  const top = Math.max(1, ...rows.map((r) => r.done + r.open));
  const opens = rows.map((r) => r.open);
  const uneven = Math.max(...opens) - Math.min(...opens) >= 4;
  const none = rows.every((r) => r.done + r.open === 0);

  return (
    <div className="rm-card">
      <p className="rm-intro">Effort points show who is carrying how much. It is a view of the work, not a scoreboard: nobody wins by doing more.</p>

      {none ? (
        <p className="rm-empty">Add and finish a few chores and the picture fills in here.</p>
      ) : (
        <ul className="rm-fair" aria-label="Effort by roommate">
          {rows.map((r) => (
            <li key={r.m}>
              <div className="rm-fair-name"><Avatar name={r.m} members={space.members} size={28} /><strong>{r.m === YOU ? "You" : r.m}</strong></div>
              <div className="rm-bar-track" role="img" aria-label={`${r.m === YOU ? "You have" : r.m + " has"} ${r.done} points done in the last 30 days and ${r.open} still open`}>
                <span className="rm-bar-done" style={{ width: `${(r.done / top) * 100}%` }} />
                <span className="rm-bar-open" style={{ width: `${(r.open / top) * 100}%` }} />
              </div>
              <span className="rm-fair-num">{r.done} done · {r.open} open</span>
            </li>
          ))}
        </ul>
      )}

      <div className="rm-legend" aria-hidden="true"><span><i className="d" />Finished in the last 30 days</span><span><i className="o" />Still open</span></div>
      {!none && uneven && <p className="rm-nudge">Open work isn’t evenly spread right now. Auto-assign the next chore to even it out.</p>}
    </div>
  );
}
