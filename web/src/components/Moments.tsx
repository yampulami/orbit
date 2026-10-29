import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, MapPin, Sparkles } from "lucide-react";
import AvatarStack from "./AvatarStack";
import { findConflict, hangActions } from "../lib/hangouts";
import { headline, INTERESTS, lengthLabel, whenLabel, type Moment } from "../lib/moments";
import { momentActions, useMomentPrefs } from "../lib/momentPrefs";
import { useMoments } from "../lib/useMoments";
import { haptic } from "../lib/haptics";
import { notice } from "../lib/notice";

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const labelOf = (c: Moment["category"]) => INTERESTS.find((i) => i.id === c)?.label.toLowerCase() ?? c;

/** One suggestion. "Make a plan" opens an editable draft first: nothing is sent to anyone until the student confirms it. */
export function MomentCard({ m, row = false }: { m: Moment; /** A compact line instead of a full card. */ row?: boolean }) {
  const nav = useNavigate();
  const [drafting, setDrafting] = useState(false);
  const [title, setTitle] = useState(m.event?.title ?? "Hang out");
  const [place, setPlace] = useState(m.event?.place ?? "");
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // The "Not now" menu closes when you press outside it, press Escape, or choose something.
  useEffect(() => {
    if (!menu) return;
    const out = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setMenu(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("pointerdown", out);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", out); document.removeEventListener("keydown", esc); };
  }, [menu]);
  const pick = (fn: () => void) => () => { fn(); setMenu(false); };

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

  const notNow = !drafting && (
    <div className="moment-more" ref={box}>
      <button type="button" className="link-btn" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu((v) => !v)}>Not now</button>
      {menu && (
        <ul className="moment-menu" role="menu">
          <li><button type="button" role="menuitem" onClick={pick(() => momentActions.dismiss(m))}>Not interested</button></li>
          <li><button type="button" role="menuitem" onClick={pick(() => { momentActions.dismiss(m); notice.show({ icon: "calendar", title: "Okay", message: "Try Find a time to pick a different one.", ms: 3500 }); })}>Prefer another time</button></li>
          <li><button type="button" role="menuitem" onClick={pick(() => { momentActions.muteType(m.category); momentActions.dismiss(m); })}>Do not suggest {labelOf(m.category)}</button></li>
          <li><button type="button" role="menuitem" onClick={pick(() => momentActions.hideCircle(m.circleId))}>Hide {m.circleName}</button></li>
        </ul>
      )}
    </div>
  );
  const draft = drafting && (
    <form className="moment-draft" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <label>What<input value={title} maxLength={80} onChange={(e) => { setTitle(e.target.value); setError(""); }} /></label>
      <label>Where<input value={place} maxLength={80} placeholder="Pick a spot" onChange={(e) => setPlace(e.target.value)} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="muted">Nothing is sent until you press Send. It becomes a hangout in {m.circleName}, and everyone answers yes or no.</p>
      <div className="moment-btns"><button className="btn primary sm">Send to {m.circleName}</button><button type="button" className="btn sm" onClick={() => { setDrafting(false); setError(""); }}>Cancel</button></div>
    </form>
  );

  if (row) {
    return (
      <article className="moment row" aria-label="A suggestion from Orbit">
        <div className="mr-main">
          <b>{whenLabel(m)}</b>
          <small>{headline(m)}{m.unknown.length ? ` · ${m.unknown.length} not sharing` : ""}</small>
        </div>
        {!drafting && <div className="mr-act"><button type="button" className="btn primary sm" onClick={() => setDrafting(true)}>Make a plan</button>{notNow}</div>}
        {draft}
      </article>
    );
  }

  return (
    <article className="moment" aria-label="A suggestion from Orbit">
      <header>
        <span className="moment-tag"><Sparkles size={12} aria-hidden="true" /> Your schedules line up</span>
        {notNow}
      </header>
      <h3>{headline(m)}</h3>
      <p className="moment-when"><b>{whenLabel(m)}</b> <span>· {lengthLabel(m)}</span>{m.event?.place && <span className="moment-place"><MapPin size={12} aria-hidden="true" /> {m.event.place}</span>}</p>
      <div className="moment-who">
        <AvatarStack people={m.people.map((p) => ({ name: p.name }))} max={4} size={24} />
        <small>{m.why.slice(0, 2).join(" · ")}</small>
      </div>

      {drafting ? draft : (
        <div className="moment-btns">
          <button type="button" className="btn primary sm" onClick={() => setDrafting(true)}>Make a plan</button>
        </div>
      )}
    </article>
  );
}

/** On the Sync page: the suggestions, open. */
export default function Moments({ limit = 4 }: { limit?: number }) {
  const { moments, loading, enabled } = useMoments(limit);
  if (!enabled) return null;
  if (moments.length === 0) return <p className="muted moments-empty" role="status">{loading ? "Looking at your groups…" : "Nothing lines up yet. Suggestions appear when people in your groups share their free time and a good time opens up."}</p>;
  return (
    <section className="moments" aria-label="Orbit Moments">
      {moments.map((m) => <MomentCard key={m.id} m={m} />)}
    </section>
  );
}

/** On the feed: one line (how many plans may line up, with faces). Open it to see them, fold it away again. Shows nothing when there is nothing to show. */
export function MomentsBar({ always = false, limit = 3 }: { /** Show it even when "show on the feed" is off (the Sync page). */ always?: boolean; limit?: number }) {
  const prefs = useMomentPrefs();
  const { moments, loading } = useMoments(limit);
  if (!prefs.enabled || (!always && !prefs.showOnFeed)) return null;
  if (moments.length === 0) return always ? <p className="muted moments-empty" role="status">{loading ? "Looking at your groups…" : "Nothing lines up yet. Suggestions appear when people in your groups share their free time and a good time opens up."}</p> : null;
  const open = !prefs.collapsed;
  const faces = [...new Map(moments.flatMap((m) => m.people).map((p) => [p.id, p])).values()];
  return (
    <section className="momentsbar" data-open={open ? "" : undefined} aria-label="Orbit Moments">
      <button type="button" className="mb-head" aria-expanded={open} onClick={() => momentActions.setCollapsed(open)}>
        <Sparkles size={15} aria-hidden="true" />
        <span className="mb-t"><b>{moments.length === 1 ? "A plan may line up" : `${moments.length} plans may line up`}</b>{!open && <small>{moments[0].event ? moments[0].event.title : "Free together"} · {whenLabel(moments[0])}</small>}</span>
        {!open && <AvatarStack people={faces.map((p) => ({ name: p.name }))} max={3} size={22} />}
        <ChevronDown size={16} className="mb-chev" aria-hidden="true" />
      </button>
      {open && (
        <div className="mb-body">
          {moments.map((m) => <MomentCard key={m.id} m={m} row />)}
          {!always && <Link to="/app/sync" className="link-btn mb-more">All suggestions and settings</Link>}
        </div>
      )}
    </section>
  );
}

/** Inside a group chat: one line if this group has a shared opening, which opens into the card. */
export function GroupMoment({ groupId }: { groupId: string }) {
  const { moments } = useMoments(8);
  const [open, setOpen] = useState(false);
  const m = moments.find((x) => x.circleId === groupId);
  if (!m) return null;
  return (
    <div className="momentsbar group" data-open={open ? "" : undefined}>
      <button type="button" className="mb-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Sparkles size={15} aria-hidden="true" />
        <span className="mb-t"><b>Free together {whenLabel(m)}</b></span>
        <ChevronDown size={16} className="mb-chev" aria-hidden="true" />
      </button>
      {open && <div className="mb-body"><MomentCard m={m} row /></div>}
    </div>
  );
}
