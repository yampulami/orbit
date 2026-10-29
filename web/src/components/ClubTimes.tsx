import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { clubFreeCounts, type ClubCount } from "../lib/availability";
import { bestClubTimes } from "../lib/clubTimes";
import { DAY_NAMES } from "../lib/classes";
import { timeLabel } from "../lib/freeTime";

const LENGTHS = [{ m: 60, l: "1 hr" }, { m: 90, l: "1.5 hr" }, { m: 120, l: "2 hr" }];
const MIN_SHARED = 5;

/** For a club's officers: the weekly times most members are free, as numbers only. Members choose to be counted, and nothing shows until at least 5 have. */
export default function ClubTimes({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState(60);
  const [state, setState] = useState<{ counts: ClubCount[]; agreed: number; error?: string } | null>(null);

  useEffect(() => {
    if (!open || state) return;
    let live = true;
    void clubFreeCounts(orgId).then((r) => { if (live) setState(r); });
    return () => { live = false; };
  }, [open, orgId, state]);

  const times = state ? bestClubTimes(state.counts, { duration, max: 5 }) : [];
  return (
    <section className="club-times" aria-label="Best meeting times">
      <button type="button" className="chan-compose" aria-expanded={open} onClick={() => setOpen((v) => !v)}><CalendarClock size={16} aria-hidden="true" /> Best meeting times</button>
      {open && (
        <div className="ct-body">
          <p className="muted">When most members are free each week. Members choose to be counted in Plans, and you only ever see numbers, never who.</p>
          {!state ? <p className="muted" role="status">Looking…</p>
            : state.error ? <p className="muted">{state.error}</p>
            : state.counts.length === 0 ? <p className="muted">Not enough members are counted yet to keep it anonymous: {state.agreed} of {MIN_SHARED}. Ask members to turn on "Count me in my clubs' meeting times" under Schedule sync in Plans.</p>
            : (
              <>
                <div className="chip-row" role="group" aria-label="Meeting length">{LENGTHS.map((l) => <button key={l.m} type="button" className="chip-btn" aria-pressed={duration === l.m} onClick={() => setDuration(l.m)}>{l.l}</button>)}</div>
                <ul className="ct-list">
                  {times.map((t, i) => (
                    <li key={`${t.weekday}-${t.start}`} data-best={i === 0 ? "" : undefined}>
                      <b>{DAY_NAMES[t.weekday]}s</b> <span>{timeLabel(t.start)} to {timeLabel(t.end)}</span>
                      <span className="ct-bar" aria-hidden="true"><i style={{ width: `${Math.round((t.free / t.total) * 100)}%` }} /></span>
                      <small>{t.free} of {t.total} members free</small>
                    </li>
                  ))}
                </ul>
                <p className="muted">Counts only include members who chose to be counted, and only their weekly classes.</p>
              </>
            )}
        </div>
      )}
    </section>
  );
}
