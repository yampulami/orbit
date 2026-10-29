import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, Sparkles } from "lucide-react";
import AvatarStack from "./AvatarStack";
import { findConflict, hangActions } from "../lib/hangouts";
import { headline, INTERESTS, lengthLabel, whenLabel, type Moment } from "../lib/moments";
import { momentActions } from "../lib/momentPrefs";
import { useMoments } from "../lib/useMoments";
import { haptic } from "../lib/haptics";
import { notice } from "../lib/notice";

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const labelOf = (c: Moment["category"]) => INTERESTS.find((i) => i.id === c)?.label.toLowerCase() ?? c;

/** One suggestion. "Make a plan" opens an editable draft first: nothing is sent to anyone until the student confirms it. */
export function MomentCard({ m, compact = false }: { m: Moment; compact?: boolean }) {
  const nav = useNavigate();
  const [drafting, setDrafting] = useState(false);
  const [title, setTitle] = useState(m.event?.title ?? "Hang out");
  const [place, setPlace] = useState(m.event?.place ?? "");
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(false);

  function send() {
    const when = toLocalInput(m.start);
    const clash = findConflict(when);
    if (clash) { setError(`You already have "${clash.title}" then.`); return; }
    if (!title.trim()) { setError("Give the plan a name."); return; }
    hangActions.createHangout(m.circleId, { title: title.trim().slice(0, 80), place: place.trim().slice(0, 80) || "Pick a spot", when });
    momentActions.interested(m);
    momentActions.dismiss(m);
    haptic("success");
    notice.show({ icon: "calendar", title: "Plan sent to the group", message: `${m.circleName} can answer it now.`, ms: 4000 });
    nav("/app/chats?tab=groups");
  }

  return (
    <article className="moment" data-compact={compact ? "" : undefined} aria-label="A suggestion from Orbit">
      <header>
        <span className="moment-tag"><Sparkles size={12} aria-hidden="true" /> Your schedules line up</span>
        {!drafting && (
          <div className="moment-more">
            <button type="button" className="link-btn" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>Not now</button>
            {menu && (
              <ul className="moment-menu" role="menu">
                <li><button type="button" role="menuitem" onClick={() => { momentActions.dismiss(m); }}>Not interested</button></li>
                <li><button type="button" role="menuitem" onClick={() => { momentActions.dismiss(m); notice.show({ icon: "calendar", title: "Okay", message: "Try Find a time to pick a different one.", ms: 3500 }); }}>Prefer another time</button></li>
                <li><button type="button" role="menuitem" onClick={() => { momentActions.muteType(m.category); momentActions.dismiss(m); }}>Do not suggest {labelOf(m.category)}</button></li>
                <li><button type="button" role="menuitem" onClick={() => { momentActions.hideCircle(m.circleId); }}>Hide suggestions for {m.circleName}</button></li>
              </ul>
            )}
          </div>
        )}
      </header>
      <h3>{headline(m)}</h3>
      <p className="moment-when"><b>{whenLabel(m)}</b> <span>· {lengthLabel(m)}</span>{m.event?.place && <span className="moment-place"><MapPin size={12} aria-hidden="true" /> {m.event.place}</span>}</p>
      <div className="moment-who">
        <AvatarStack people={m.people.map((p) => ({ name: p.name }))} max={4} size={26} />
        <small>{m.why.slice(0, 2).join(" · ")}</small>
      </div>

      {drafting ? (
        <form className="moment-draft" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label>What<input value={title} maxLength={80} onChange={(e) => { setTitle(e.target.value); setError(""); }} /></label>
          <label>Where<input value={place} maxLength={80} placeholder="Pick a spot" onChange={(e) => setPlace(e.target.value)} /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <p className="muted">Nothing is sent until you press Send. It becomes a hangout in {m.circleName}, and everyone answers yes or no.</p>
          <div className="moment-btns"><button className="btn primary sm">Send to {m.circleName}</button><button type="button" className="btn sm" onClick={() => { setDrafting(false); setError(""); }}>Cancel</button></div>
        </form>
      ) : (
        <div className="moment-btns">
          <button type="button" className="btn primary sm" onClick={() => setDrafting(true)}>Make a plan</button>
          {!compact && <Link to="/app/sync" className="link-btn">Other times</Link>}
        </div>
      )}
    </article>
  );
}

/** The suggestions for right now. On the feed it shows nothing unless Moments is on and something lines up; on the Sync page it explains itself. */
export default function Moments({ limit = 2, page = false }: { limit?: number; page?: boolean }) {
  const { moments, loading, enabled } = useMoments(limit);
  if (!enabled) return null;
  if (moments.length === 0) {
    return page ? <p className="muted moments-empty" role="status">{loading ? "Looking at your groups…" : "Nothing lines up yet. Moments appear when people in your groups share their free time and a good time opens up."}</p> : null;
  }
  return (
    <section className="moments" aria-label="Orbit Moments">
      {moments.map((m) => <MomentCard key={m.id} m={m} />)}
    </section>
  );
}

/** Inside a group chat: if this group has a shared opening, say so right there. */
export function GroupMoment({ groupId }: { groupId: string }) {
  const { moments } = useMoments(8);
  const m = moments.find((x) => x.circleId === groupId);
  return m ? <MomentCard m={m} compact /> : null;
}
