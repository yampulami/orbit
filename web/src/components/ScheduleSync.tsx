import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown, Sparkles, Users } from "lucide-react";
import { useFriends } from "../lib/friends";
import { hangActions } from "../lib/hangouts";
import { useCampusEvents } from "../lib/campusEvents";
import { loadFriendFree } from "../lib/availability";
import { busySpans, suggestTimes, timeLabel, weeklyTimes, type Person, type Suggestion, type WeeklySlot } from "../lib/freeTime";
import { useMyBusy } from "../lib/useMyBusy";
import { useMapPlaces } from "../lib/mapPlaces";
import { padForTravel } from "../lib/travel";
import { blocksFromClasses } from "../lib/freeTime";
import { makeGroupAndInvite } from "../lib/groupInvite";
import { DAY_NAMES } from "../lib/classes";
import { haptic } from "../lib/haptics";
import { notice } from "../lib/notice";

const LENGTHS = [{ m: 30, l: "30 min" }, { m: 60, l: "1 hr" }, { m: 90, l: "1.5 hr" }, { m: 120, l: "2 hr" }, { m: 180, l: "3 hr" }];
const WINDOWS = [{ d: 1, l: "Today" }, { d: 3, l: "3 days" }, { d: 7, l: "This week" }, { d: 14, l: "2 weeks" }];
const GRID_FROM = 8 * 60, GRID_TO = 22 * 60;

const dayLabel = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const clock = (d: Date) => timeLabel(d.getHours() * 60 + d.getMinutes());
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

/** Next time that weekday and minute come round (today if it has not passed). */
function nextOccurrence(weekday: number, minute: number, now: Date): Date {
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 0, minute);
    if (d.getDay() === weekday && d.getTime() > now.getTime()) return d;
  }
  return new Date(now.getTime() + 86400000);
}

/**
 * Schedule Sync: pick people, say how long you need and how soon, and see the best times ranked, with who can make each and why it was picked.
 * Inside a group (`groupId`) a chosen time becomes a hangout in that group; otherwise it makes a private group and messages the friends a link.
 */
export default function ScheduleSync({ groupId, people: given, title = "Find a time" }: { groupId?: string; /** A fixed set of people (a group or a household), instead of picking friends. Only those who share with you count. */ people?: { id: string; name: string }[]; title?: string }) {
  const { friends } = useFriends();
  const nav = useNavigate();
  const { events } = useCampusEvents();
  const [now] = useState(() => new Date());
  const { me: base, input } = useMyBusy(now);
  const { live: places } = useMapPlaces();
  const [whereId, setWhereId] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [shared, setShared] = useState<Person[]>([]);
  const [notSharing, setNotSharing] = useState<string[]>([]);
  const [duration, setDuration] = useState(60);
  const [days, setDays] = useState(7);
  const [everyone, setEveryone] = useState(true);
  const [buffer, setBuffer] = useState(false);
  const [weekly, setWeekly] = useState(false);
  const [dayIdx, setDayIdx] = useState(0);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [gridOpen, setGridOpen] = useState(false);
  const [making, setMaking] = useState(false);
  const [error, setError] = useState("");

  const chosen = useMemo(() => given ?? friends.filter((f) => picked.includes(f.id)), [given, friends, picked]);
  const key = chosen.map((f) => f.id).join(",");
  useEffect(() => {
    let live = true;
    if (chosen.length === 0) { setShared([]); setNotSharing([]); return; }
    void loadFriendFree(chosen).then((r) => { if (live) { setShared(r.sharing); setNotSharing(r.notSharing); } });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const spot = places.find((p) => p.id === whereId);
  // Picking where you will meet makes room for the walk from the buildings your classes are in.
  const travel = useMemo(() => (spot ? padForTravel(input.classes, places, spot) : null), [spot, input.classes, places]);
  const me: Person = useMemo(() => (travel ? { ...base, blocks: blocksFromClasses(travel.classes) } : base), [base, travel]);
  const people: Person[] = useMemo(() => [me, ...shared], [me, shared]);
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "Someone";
  const first = (id: string) => (id === "me" ? "You" : nameOf(id).split(" ")[0]);

  const suggestions: Suggestion[] = useMemo(
    () => (weekly ? [] : suggestTimes(people, now, { duration, days, everyone: everyone || people.length < 3, buffer: buffer ? 15 : 0, max: 6 })),
    [people, now, duration, days, everyone, buffer, weekly],
  );
  const weeklySlots: WeeklySlot[] = useMemo(
    () => (weekly ? weeklyTimes(people, { duration, everyone: everyone || people.length < 3, buffer: buffer ? 15 : 0, max: 6 }) : []),
    [people, duration, everyone, buffer, weekly],
  );

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(0, 8)));

  /** A campus event on at the same time, if there is one worth mentioning. */
  const eventAt = (start: Date, end: Date) => events.find((e) => e.status === "published" && !e.canceled && new Date(e.startsAt) < end && new Date(e.endsAt ?? new Date(new Date(e.startsAt).getTime() + 2 * 3600000)) > start);

  async function plan(start: Date, id: string) {
    setMaking(true); setError("");
    const when = toLocalInput(start);
    if (groupId) {
      hangActions.createHangout(groupId, { title: "Hang out", place: spot?.name ?? "Pick a spot", when });
      setMaking(false); setConfirm(null);
      haptic("success");
      notice.show({ icon: "calendar", title: "Hangout planned", message: "Everyone in the group can answer it now. Pick a place in the chat.", ms: 4000 });
      return;
    }
    const label = chosen.map((f) => f.name.split(" ")[0]).slice(0, 3).join(", ");
    const out = await makeGroupAndInvite({ name: label ? `Hangout with ${label}` : "Hangout", friends: chosen, hangout: { title: "Hang out", place: spot?.name ?? "Pick a spot", when } });
    setMaking(false); setConfirm(null);
    if (out.error) { setError(out.error); return; }
    haptic("success");
    notice.show({ icon: "calendar", title: "Plan made", message: out.invited.length ? `${out.invited.join(", ")} got an invite link. Pick a place in the group chat.` : "Pick a place in the group chat.", ms: 4500 });
    void id;
    nav("/app/groups");
  }

  // The grid shows one day: the day of the best suggestion to start with.
  const dayList = useMemo(() => Array.from({ length: Math.min(days, 7) }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)), [now, days]);
  useEffect(() => { setDayIdx(0); }, [days]);
  const gridDay = dayList[Math.min(dayIdx, dayList.length - 1)];
  const mark = suggestions.filter((s) => s.start.toDateString() === gridDay.toDateString());

  const crowd = people.length;
  const canPlan = (crowd > 1 || !!groupId) && (!given || !!groupId);

  return (
    <div className="sync">
      {given ? (
        <h3 className="ft-h"><Users size={14} aria-hidden="true" /> {title}</h3>
      ) : (
        <button type="button" className="sync-pick" aria-expanded={pickOpen} onClick={() => setPickOpen((v) => !v)}>
          <Users size={14} aria-hidden="true" />
          <span>{title}</span>
          <small>{picked.length ? `with ${picked.length} ${picked.length === 1 ? "friend" : "friends"}` : "just you"}</small>
          <ChevronDown size={14} className="fold-chev" aria-hidden="true" />
        </button>
      )}
      {!given && pickOpen && (
        friends.length === 0
          ? <p className="muted">Add a friend first, then find a time that works for both of you.</p>
          : <div className="chip-row" role="group" aria-label="Who to find a time with">
              {friends.map((f) => <button key={f.id} type="button" className="chip-btn" aria-pressed={picked.includes(f.id)} onClick={() => toggle(f.id)}>{f.name}</button>)}
            </div>
      )}
      {notSharing.length > 0 && <p className="muted sync-note">{notSharing.join(", ")} {notSharing.length === 1 ? "has" : "have"} not turned on free-time sharing, so {notSharing.length === 1 ? "they are" : "they are"} left out.</p>}

      <div className="sync-opts">
        <div className="sync-bar">
          <label>How long<select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{LENGTHS.map((l) => <option key={l.m} value={l.m}>{l.l}</option>)}</select></label>
          {!weekly && <label>How soon<select value={days} onChange={(e) => setDays(Number(e.target.value))}>{WINDOWS.map((w) => <option key={w.d} value={w.d}>{w.l}</option>)}</select></label>}
        </div>
        <details className="sync-adv">
          <summary>More</summary>
        <div className="sync-opt"><span id="sy-where">Where (optional)</span>
          <select className="sync-where" aria-labelledby="sy-where" value={whereId} onChange={(e) => setWhereId(e.target.value)}>
            <option value="">Anywhere</option>
            {places.filter((p) => p.category !== "transit").slice(0, 80).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {spot && <small className="muted">{travel && travel.longest > 0 ? `Leaves up to ${travel.longest} min around your classes to walk to ${spot.name}.` : `Your classes are close to ${spot.name}.`}</small>}
        </div>
        <div className="sync-toggles">
          <label><input type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} /> Repeats every week</label>
          {crowd > 2 && <label><input type="checkbox" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} /> Everyone must be free</label>}
          <label><input type="checkbox" checked={buffer} onChange={(e) => setBuffer(e.target.checked)} /> Leave 15 min around classes</label>
        </div>
        </details>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {!weekly && (
        suggestions.length === 0
          ? <p className="muted">No {duration >= 60 ? span(duration) : `${duration} min`} stretch works{crowd > 1 ? " for everyone" : ""} in this time. Try a shorter length, a longer window{crowd > 2 ? ", or untick \"Everyone must be free\"" : ""}.</p>
          : <ul className="sync-list">
              {(showAll ? suggestions : suggestions.slice(0, 3)).map((s) => {
                const ev = eventAt(s.start, s.end);
                const id = s.start.toISOString();
                return (
                  <li key={id} data-best={s.best ? "" : undefined}>
                    <div className="sr-main">
                      <b>{s.best && <Sparkles size={12} className="sr-star" aria-label="Best match" />}{dayLabel(s.start)} · {clock(s.start)}–{clock(s.end)}</b>
                      <small>{[...(crowd > 1 && s.missing.length ? [`${s.missing.map(first).join(", ")} can't`] : []), ...s.reasons.filter((r) => !/^Everyone is free$|free$/.test(r)).slice(0, 2), ...(ev ? [`Also on: ${ev.title}`] : [])].join(" · ")}</small>
                    </div>
                    {crowd > 1 && <span className="sync-count" data-all={s.missing.length === 0 ? "" : undefined}>{s.available.length}/{crowd}</span>}
                    {canPlan && confirm !== id && <button type="button" className="btn sm" onClick={() => setConfirm(id)}>Plan</button>}
                    {canPlan && confirm === id && (
                      <div className="sync-confirm">
                        <p className="muted">{groupId ? "Plans a hangout in this group." : `Makes a private group, plans it, and messages ${chosen.map((f) => f.name.split(" ")[0]).join(", ")} a link.`}</p>
                        <button type="button" className="btn sm primary" disabled={making} onClick={() => void plan(s.start, id)}>{making ? "Making it…" : "Confirm"}</button>
                        <button type="button" className="btn sm" disabled={making} onClick={() => setConfirm(null)}>Cancel</button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
      )}
      {!weekly && suggestions.length > 3 && <button type="button" className="link-btn sync-more" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show fewer" : `Show ${suggestions.length - 3} more`}</button>}

      {weekly && (
        weeklySlots.length === 0
          ? <p className="muted">No time repeats every week for everyone. Try a shorter length.</p>
          : <ul className="sync-list">
              {weeklySlots.map((w, i) => {
                const start = nextOccurrence(w.weekday, w.start, now);
                const id = `w${w.weekday}-${w.start}`;
                return (
                  <li key={id} data-best={i === 0 ? "" : undefined}>
                    <div className="sr-main">
                      <b>{i === 0 && <Sparkles size={12} className="sr-star" aria-label="Best match" />}Every {DAY_NAMES[w.weekday]} · {timeLabel(w.start)}–{timeLabel(w.end)}</b>
                      <small>{[...(w.missing.length ? [`${w.missing.map(first).join(", ")} can't`] : []), "Classes only, holds every week"].join(" · ")}</small>
                    </div>
                    {crowd > 1 && <span className="sync-count" data-all={w.missing.length === 0 ? "" : undefined}>{w.available.length}/{crowd}</span>}
                    {canPlan && confirm !== id && <button type="button" className="btn sm" onClick={() => setConfirm(id)}>Plan</button>}
                    {canPlan && confirm === id && (
                      <div className="sync-confirm">
                        <p className="muted">Plans the first one, {dayLabel(start)}.</p>
                        <button type="button" className="btn sm primary" disabled={making} onClick={() => void plan(start, id)}>{making ? "Making it…" : "Confirm"}</button>
                        <button type="button" className="btn sm" disabled={making} onClick={() => setConfirm(null)}>Cancel</button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
      )}

      {!weekly && crowd > 0 && <button type="button" className="link-btn sync-more" aria-expanded={gridOpen} onClick={() => setGridOpen((v) => !v)}>{gridOpen ? "Hide everyone's day" : "Show everyone's day"}</button>}
      {!weekly && crowd > 0 && gridOpen && (
        <div className="sync-grid" aria-label="Everyone's day">
          <div className="chip-row" role="group" aria-label="Which day to show">
            {dayList.map((d, i) => <button key={i} type="button" className="chip-btn" aria-pressed={dayIdx === i} onClick={() => setDayIdx(i)}>{i === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</button>)}
          </div>
          <div className="sg-axis" aria-hidden="true">{[8, 10, 12, 14, 16, 18, 20, 22].map((h) => <span key={h} style={{ left: `${((h * 60 - GRID_FROM) / (GRID_TO - GRID_FROM)) * 100}%` }}>{h === 12 ? "12" : h > 12 ? h - 12 : h}{h >= 12 ? "p" : "a"}</span>)}</div>
          {people.map((p) => (
            <div key={p.id} className="sg-row">
              <span className="sg-name">{p.id === "me" ? "You" : p.name.split(" ")[0]}</span>
              <div className="sg-track" role="img" aria-label={`${p.id === "me" ? "Your" : p.name.split(" ")[0] + "'s"} busy and free hours`}>
                {busySpans(p, gridDay).map(([s, e], i) => {
                  const a = Math.max(s, GRID_FROM), b = Math.min(e, GRID_TO);
                  return b > a ? <i key={i} className="sg-busy" style={{ left: `${((a - GRID_FROM) / (GRID_TO - GRID_FROM)) * 100}%`, width: `${((b - a) / (GRID_TO - GRID_FROM)) * 100}%` }} /> : null;
                })}
                {mark.map((m) => {
                  const a = m.start.getHours() * 60 + m.start.getMinutes(), b = a + duration;
                  return <i key={m.start.toISOString()} className="sg-pick" data-best={m.best ? "" : undefined} style={{ left: `${((a - GRID_FROM) / (GRID_TO - GRID_FROM)) * 100}%`, width: `${((b - a) / (GRID_TO - GRID_FROM)) * 100}%` }} />;
                })}
              </div>
            </div>
          ))}
          <p className="sg-key"><i className="sg-busy" /> busy <i className="sg-pick" /> suggested <Check size={12} aria-hidden="true" /> the rest is free</p>
        </div>
      )}
    </div>
  );
}

function span(m: number) { const h = Math.floor(m / 60), r = m % 60; return r ? `${h}.${r === 30 ? "5" : r} hr` : `${h} hr`; }
