import { useState } from "react";
import { Clock } from "lucide-react";
import { useClasses } from "../lib/classes";
import { useMyBusy } from "../lib/useMyBusy";
import { describeBusy } from "../lib/myBusy";
import { availabilityActions, useSharing } from "../lib/availability";
import { haptic } from "../lib/haptics";
import { supabase } from "../lib/supabase";
import ScheduleSync from "./ScheduleSync";

/** Schedule Sync on the Plans page: the sharing switch, how it works, and finding a time with friends. */
export default function FreeTimePanel() {
  const classes = useClasses();
  const sharing = useSharing();
  const { today } = useMyBusy(new Date());
  const [error, setError] = useState("");

  async function flip(on: boolean) {
    setError("");
    haptic("select");
    const problem = await availabilityActions.setSharing(on, classes);
    if (problem) setError(problem);
  }

  const live = !!supabase;
  return (
    <section className="freetime" aria-label="Schedule sync">
      <header>
        <h2><Clock size={16} aria-hidden="true" /> Schedule sync</h2>
      </header>
      {live && !sharing.missing && (
        <div className="ft-share">
          <div>
            <b id="ft-share-l">Let friends see when I am free</b>
            <span>They see the hours you are busy, never what for. Off until you turn it on, and turning it off deletes it.</span>
          </div>
          <button type="button" role="switch" aria-checked={sharing.on} aria-labelledby="ft-share-l" className="switch" disabled={!sharing.ready} onClick={() => void flip(!sharing.on)}><span /></button>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}

      <details className="ft-how">
        <summary>How this works</summary>
        <p>Orbit looks at your day and finds the hours with nothing on. It counts your <b>classes</b>, <b>hangouts</b> you have not turned down, <b>events</b> you are going to, interested in or hosting, and <b>reminders</b> that have a time.</p>
        <p>Pick friends to see when <i>all of you</i> are free. Times are ranked: more people free is better, daytime and mealtimes score higher, and a time with room around it beats one squeezed against a class. A friend only counts if they turned on sharing, and they share just the hours they are busy.</p>
        <p><b>Counted today</b></p>
        {today.length === 0 ? <p className="muted">Nothing today, so the whole day is free.</p> : <ul>{today.map((t, i) => <li key={i}>{describeBusy(t)} <small>({t.kind})</small></li>)}</ul>}
      </details>

      <ScheduleSync />
    </section>
  );
}
