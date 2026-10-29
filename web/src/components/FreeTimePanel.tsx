import { useState } from "react";
import { Check, Clock, UserCheck, Users } from "lucide-react";
import StackedList from "./StackedList";
import { gradientFor } from "../lib/look";
import Segmented from "./Segmented";
import { useClasses } from "../lib/classes";
import { useMyBusy } from "../lib/useMyBusy";
import { describeBusy } from "../lib/myBusy";
import { availabilityActions, useSharing, type Audience } from "../lib/availability";
import { useFriends } from "../lib/friends";
import { haptic } from "../lib/haptics";
import { supabase } from "../lib/supabase";
import ScheduleSync from "./ScheduleSync";
import MomentSettings from "./MomentSettings";
import { MomentsBar } from "./Moments";

/** Schedule Sync, as a page: finding a time first, and one card of settings (who sees your free time, Moments, how it works) beside it. */
export default function FreeTimePanel({ preselect }: { /** Friends to start with (from the "you are both free" card). */ preselect?: string[] }) {
  const classes = useClasses();
  const sharing = useSharing();
  const { today } = useMyBusy(new Date());
  const { friends } = useFriends();
  const [error, setError] = useState("");

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
      <header><h2><Clock size={16} aria-hidden="true" /> Schedule sync</h2></header>
      <div className="ft-cols">
        <div className="ft-main">
          {live && <div className="nowstrip"><MomentsBar always limit={4} /></div>}
          <ScheduleSync initialPicked={preselect} />
        </div>

        <aside className="ft-side" aria-label="Sharing and suggestions">
          {live && !sharing.missing && (
            <div className="ft-blk">
              <div className="ft-share">
                <div>
                  <b id="ft-share-l">Share when I am free</b>
                  <span>Friends see only when you are busy, never why.</span>
                </div>
                <button type="button" role="switch" aria-checked={sharing.on} aria-labelledby="ft-share-l" className="switch" disabled={!sharing.ready} onClick={() => void flip(!sharing.on)}><span /></button>
              </div>
              {sharing.on && (
                <div className="ft-aud">
                  <Segmented label="Who can see it" value={who.audience} onChange={(a) => void audience({ ...who, audience: a })} options={[{ value: "friends", label: "All friends", icon: <Users size={13} aria-hidden="true" /> }, { value: "selected", label: "Some friends", icon: <UserCheck size={13} aria-hidden="true" /> }]} />
                  {who.audience === "selected" && (
                    friends.length === 0
                      ? <p className="muted">Add a friend first, then choose who can see it.</p>
                      : (
                        <StackedList
                          key={friends.length}
                          title="Who can see it"
                          subtitle={who.allowed.length === 0 ? "nobody yet · tick friends" : `${who.allowed.length} of ${friends.length} friends`}
                          icon={<UserCheck size={18} />}
                          people={friends.filter((f) => who.allowed.includes(f.id)).map((f) => ({ name: f.name }))}
                          items={friends}
                          getKey={(f) => f.id}
                          itemText={(f) => `${f.name} ${f.username ?? ""}`}
                          defaultOpen={who.allowed.length === 0}
                          renderItem={(f) => (
                            <button type="button" className="sl-row" aria-pressed={who.allowed.includes(f.id)} onClick={() => togglePerson(f.id)}>
                              <span className="sl-face" style={{ background: gradientFor(f.name) }} aria-hidden="true">{f.name.trim().slice(0, 1).toUpperCase()}</span>
                              <span className="sl-name">{f.name}{f.username && <small>@{f.username}</small>}</span>
                              <span className="sl-tick" aria-hidden="true"><Check size={13} /></span>
                            </button>
                          )}
                          footer={
                            <div className="sl-quick">
                              <button type="button" className="link-btn" onClick={() => void audience({ ...who, allowed: friends.map((f) => f.id) })}>Everyone</button>
                              <button type="button" className="link-btn" onClick={() => void audience({ ...who, allowed: [] })}>Nobody</button>
                            </div>
                          }
                        />
                      )
                  )}
                  <label className="ft-check"><input type="checkbox" checked={who.housemates} onChange={(e) => void audience({ ...who, housemates: e.target.checked })} /> Housemates can see it too</label>
                  <label className="ft-check"><input type="checkbox" checked={who.clubCounts} onChange={(e) => void audience({ ...who, clubCounts: e.target.checked })} /> Count me in my clubs' meeting times <small>(officers see numbers only, never names)</small></label>
                </div>
              )}
              {error && <p className="error" role="alert">{error}</p>}
            </div>
          )}
          {live && <div className="ft-blk"><MomentSettings /></div>}
          <div className="ft-blk">
            <details className="ft-how">
              <summary>How this works</summary>
              <p>Orbit finds the hours with nothing on. It counts your <b>classes</b>, <b>hangouts</b> you have not turned down, <b>events</b> you are going to, interested in or hosting, and <b>reminders</b> with a time.</p>
              <p>Sharing is off until you turn it on, and turning it off deletes what was stored. A friend only counts if they turned on sharing, and they share just the hours they are busy. Times are ranked: more people free is better, daytime and mealtimes score higher, and room around a class beats being squeezed against one.</p>
              <p><b>Counted today</b></p>
              {today.length === 0 ? <p className="muted">Nothing today, so the whole day is free.</p> : <ul>{today.map((t, i) => <li key={i}>{describeBusy(t)} <small>({t.kind})</small></li>)}</ul>}
            </details>
          </div>
        </aside>
      </div>
    </section>
  );
}
