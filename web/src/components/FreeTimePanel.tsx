import { useState } from "react";
import { ChevronDown, Clock } from "lucide-react";
import { useClasses } from "../lib/classes";
import { useMyBusy } from "../lib/useMyBusy";
import { describeBusy } from "../lib/myBusy";
import { availabilityActions, useSharing, type Audience } from "../lib/availability";
import { useFriends } from "../lib/friends";
import { haptic } from "../lib/haptics";
import { supabase } from "../lib/supabase";
import ScheduleSync from "./ScheduleSync";

/** Schedule Sync on the Plans page: the sharing switch, how it works, and finding a time with friends. */
export default function FreeTimePanel() {
  const classes = useClasses();
  const sharing = useSharing();
  const { today } = useMyBusy(new Date());
  const { friends } = useFriends();
  const [error, setError] = useState("");
  const [shown, setShown] = useState(false);

  async function flip(on: boolean) {
    setError("");
    haptic("select");
    const problem = await availabilityActions.setSharing(on, classes);
    if (problem) setError(problem);
  }

  async function audience(next: Audience) {
    setError("");
    const problem = await availabilityActions.setAudience(next);
    if (problem) setError(problem);
  }
  const who = sharing.who;
  const togglePerson = (id: string) => void audience({ ...who, allowed: who.allowed.includes(id) ? who.allowed.filter((x) => x !== id) : [...who.allowed, id] });

  const live = !!supabase;
  return (
    <section className="freetime" aria-label="Schedule sync">
      <header className="fold-head">
        <button type="button" className="fold-title" aria-expanded={shown} onClick={() => setShown((v) => !v)}>
          <Clock size={15} aria-hidden="true" /><b>Schedule sync</b><small>{!live || sharing.missing ? "find a time" : sharing.on ? "sharing on" : "sharing off"}</small><ChevronDown size={16} className="fold-chev" aria-hidden="true" />
        </button>
      </header>
      {shown && <>
      {live && !sharing.missing && (
        <div className="ft-share">
          <div>
            <b id="ft-share-l">Let friends see when I am free</b>
            <span>They see the hours you are busy, never what for. Off until you turn it on, and turning it off deletes it.</span>
          </div>
          <button type="button" role="switch" aria-checked={sharing.on} aria-labelledby="ft-share-l" className="switch" disabled={!sharing.ready} onClick={() => void flip(!sharing.on)}><span /></button>
        </div>
      )}
      {live && !sharing.missing && sharing.on && (
        <div className="ft-aud">
          <div role="radiogroup" aria-label="Who can see it" className="ft-aud-pick">
            <button type="button" role="radio" aria-checked={who.audience === "friends"} onClick={() => void audience({ ...who, audience: "friends" })}>All my friends</button>
            <button type="button" role="radio" aria-checked={who.audience === "selected"} onClick={() => void audience({ ...who, audience: "selected" })}>Only some friends</button>
          </div>
          {who.audience === "selected" && (
            friends.length === 0
              ? <p className="muted">Add a friend first, then choose who can see it.</p>
              : <div className="chip-row" role="group" aria-label="Friends who can see my free time">{friends.map((f) => <button key={f.id} type="button" className="chip-btn" aria-pressed={who.allowed.includes(f.id)} onClick={() => togglePerson(f.id)}>{f.name}</button>)}</div>
          )}
          <label className="ft-check"><input type="checkbox" checked={who.housemates} onChange={(e) => void audience({ ...who, housemates: e.target.checked })} /> My housemates can see it too</label>
          <label className="ft-check"><input type="checkbox" checked={who.clubCounts} onChange={(e) => void audience({ ...who, clubCounts: e.target.checked })} /> Count me in my clubs' meeting times <small>(officers see numbers only, like "12 of 18 free", never names)</small></label>
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
      </>}
    </section>
  );
}
