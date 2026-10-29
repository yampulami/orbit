import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Share2 } from "lucide-react";
import { useClasses } from "../lib/classes";
import { useMyBusy } from "../lib/useMyBusy";
import { describeBusy } from "../lib/myBusy";
import { useFriends } from "../lib/friends";
import { hangActions } from "../lib/hangouts";
import { availabilityActions, loadFriendFree, useSharing } from "../lib/availability";
import { commonFree, span, type Window } from "../lib/freeTime";
import { haptic } from "../lib/haptics";
import { notice } from "../lib/notice";
import { supabase } from "../lib/supabase";

const when = (w: Window) => {
  const day = w.start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const t = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${day}, ${t(w.start)} to ${t(w.end)}`;
};

/** Share when you are busy (never why), and find a time that works for you and some friends. */
export default function FreeTimePanel() {
  const classes = useClasses();
  const sharing = useSharing();
  const { friends } = useFriends();
  const nav = useNavigate();
  const [picked, setPicked] = useState<string[]>([]);
  const [windows, setWindows] = useState<Window[] | null>(null);
  const [notSharing, setNotSharing] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const { me, today } = useMyBusy(new Date());

  async function flip(on: boolean) {
    setError("");
    haptic("select");
    const problem = await availabilityActions.setSharing(on, classes);
    if (problem) setError(problem);
  }

  async function find() {
    setBusy(true); setError(""); setWindows(null);
    const chosen = friends.filter((f) => picked.includes(f.id));
    const { sharing: shared, notSharing: missing } = await loadFriendFree(chosen);
    setNotSharing(missing);
    const found = commonFree([me, ...shared], new Date(), { days: 7, min: 60 }).slice(0, 8);
    setWindows(found);
    setBusy(false);
  }

  function plan(w: Window) {
    const chosen = friends.filter((f) => picked.includes(f.id));
    const label = chosen.length ? chosen.map((f) => f.name.split(" ")[0]).slice(0, 3).join(", ") : "";
    const gid = hangActions.createGroup(label ? `Hangout with ${label}` : "Hangout", chosen.map((f) => f.name));
    const local = new Date(w.start.getTime() - w.start.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    hangActions.createHangout(gid, { title: "Hang out", place: "Pick a spot", when: local });
    haptic("success");
    notice.show({ icon: "calendar", title: "Plan made", message: "Choose a place in the group chat.", ms: 4000 });
    nav("/app/groups");
  }

  const live = !!supabase;
  const toggle = (id: string) => { setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(0, 6))); setWindows(null); };

  return (
    <section className="freetime" aria-label="Free time">
      <header>
        <h2><Clock size={16} aria-hidden="true" /> Free time</h2>
      </header>
      {live && !sharing.missing && (
        <div className="ft-share">
          <div>
            <b id="ft-share-l">Let friends see when I am free</b>
            <span>They see the hours you are busy, never what for. Off until you turn it on.</span>
          </div>
          <button type="button" role="switch" aria-checked={sharing.on} aria-labelledby="ft-share-l" className="switch" disabled={!sharing.ready} onClick={() => void flip(!sharing.on)}><span /></button>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}

      <details className="ft-how">
        <summary>How this works</summary>
        <p>Orbit looks at your day and finds the hours with nothing on. It counts your <b>classes</b>, <b>hangouts</b> you have not turned down, <b>events</b> you are going to, interested in or hosting, and <b>reminders</b> that have a time. Anything else is free, between 8 AM and 10 PM.</p>
        <p>Pick friends below to see when <i>all of you</i> are free. A friend only counts if they turned on sharing, and they share just the hours they are busy, never the reason.</p>
        <p><b>Counted today</b></p>
        {today.length === 0 ? <p className="muted">Nothing today, so the whole day is free.</p> : <ul>{today.map((t, i) => <li key={i}>{describeBusy(t)} <small>({t.kind})</small></li>)}</ul>}
      </details>

      <h3 className="ft-h"><Share2 size={14} aria-hidden="true" /> Find a time with friends</h3>
      {friends.length === 0 ? (
        <p className="muted">Add a friend first, then find a time that works for both of you.</p>
      ) : (
        <>
          <div className="chip-row" role="group" aria-label="Friends to find a time with">
            {friends.map((f) => <button key={f.id} type="button" className="chip-btn" aria-pressed={picked.includes(f.id)} onClick={() => toggle(f.id)}>{f.name}</button>)}
          </div>
          <button type="button" className="btn primary" disabled={busy} onClick={() => void find()}>{busy ? "Looking…" : picked.length ? "Find times" : "Show my free time"}</button>
        </>
      )}

      {windows && (
        <div className="ft-out">
          {notSharing.length > 0 && <p className="muted">{notSharing.join(", ")} {notSharing.length === 1 ? "has" : "have"} not shared their free time, so {notSharing.length === 1 ? "they are" : "they are"} left out.</p>}
          {windows.length === 0 ? <p className="muted">No time of an hour or more is free for everyone this week.</p> : (
            <ul className="ft-list">
              {windows.map((w) => (
                <li key={w.start.toISOString()}>
                  <span><b>{when(w)}</b><small>{span(w.minutes)} free</small></span>
                  {picked.length > 0 && <button type="button" className="btn sm" onClick={() => plan(w)}>Plan it</button>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
