import { SweepLi, SweepUl } from "./Sweep";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, CalendarDays, Check, ChevronDown, ChevronUp, Flag, Sparkles, Star, Users, Utensils } from "lucide-react";
import Segmented from "./Segmented";
import Dropdown from "./Dropdown";
import GradientMenu, { type GMItem } from "./GradientMenu";
import StackedList from "./StackedList";
import { gradientFor } from "../lib/look";
import { useFriends } from "../lib/friends";
import { findConflict, hangActions } from "../lib/hangouts";
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

/** How many suggested times show before "more times": the best match alone, so the choice starts with one answer. */
const FIRST = 1;
const LENGTHS = [{ m: 30, l: "30m" }, { m: 60, l: "1h" }, { m: 90, l: "1.5h" }, { m: 120, l: "2h" }, { m: 180, l: "3h" }];
const WINDOWS = [{ d: 1, l: "Today" }, { d: 3, l: "3 days" }, { d: 7, l: "Week" }, { d: 14, l: "2 wks" }];
const KIND_LOOK: Record<string, { icon: typeof Users; tone: GMItem["tone"]; short: string }> = {
  hangout: { icon: Users, tone: "pink", short: "Hangout" }, study: { icon: BookOpen, tone: "blue", short: "Study" }, meal: { icon: Utensils, tone: "orange", short: "Meal" },
  club: { icon: Flag, tone: "green", short: "Club" }, custom: { icon: Sparkles, tone: "purple", short: "Other" },
};
const GRID_FROM = 8 * 60, GRID_TO = 22 * 60;

/** What the plan is for: it sets a sensible length and title, and the hours that suit it. */
const KINDS = [
  { id: "hangout", label: "Hangout", title: "Hang out", minutes: 90, from: 10 * 60, to: 22 * 60 },
  { id: "study", label: "Study session", title: "Study session", minutes: 120, from: 9 * 60, to: 21 * 60 },
  { id: "meal", label: "Meal", title: "Grab food", minutes: 60, from: 11 * 60, to: 20 * 60 },
  { id: "club", label: "Club meeting", title: "Club meeting", minutes: 60, from: 12 * 60, to: 21 * 60 },
  { id: "custom", label: "Something else", title: "Plan", minutes: 60, from: 9 * 60, to: 22 * 60 },
] as const;
type KindId = (typeof KINDS)[number]["id"];
const NOT_BEFORE = [{ m: 8 * 60, l: "Any time" }, { m: 9 * 60, l: "9 AM" }, { m: 10 * 60, l: "10 AM" }, { m: 11 * 60, l: "11 AM" }, { m: 12 * 60, l: "Noon" }, { m: 14 * 60, l: "2 PM" }, { m: 17 * 60, l: "5 PM" }];
const NOT_AFTER = [{ m: 22 * 60, l: "Any time" }, { m: 21 * 60, l: "9 PM" }, { m: 20 * 60, l: "8 PM" }, { m: 18 * 60, l: "6 PM" }, { m: 16 * 60, l: "4 PM" }];
const WEEK = [1, 2, 3, 4, 5, 6, 0];

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
export default function ScheduleSync({ groupId, people: given, initialPicked, title = "Find a time" }: { groupId?: string; /** Friends already ticked when it opens. */ initialPicked?: string[]; /** A fixed set of people (a group or a household), instead of picking friends. Only those who share with you count. */ people?: { id: string; name: string }[]; title?: string }) {
  const { friends } = useFriends();
  const nav = useNavigate();
  const { events } = useCampusEvents();
  const [now] = useState(() => new Date());
  const { me: base, input } = useMyBusy(now);
  const { live: places } = useMapPlaces();
  const [whereId, setWhereId] = useState("");
  const [picked, setPicked] = useState<string[]>(initialPicked ?? []);
  const [shared, setShared] = useState<Person[]>([]);
  const [notSharing, setNotSharing] = useState<string[]>([]);
  const [duration, setDuration] = useState(60);
  const [days, setDays] = useState(7);
  const [kind, setKind] = useState<KindId>("hangout");
  const [attend, setAttend] = useState<string>("all"); // "all", "half" or a number of people
  const [required, setRequired] = useState<string[]>([]);
  const [notBefore, setNotBefore] = useState(10 * 60); // the Hangout preset
  const [notAfter, setNotAfter] = useState(22 * 60);
  const [skipDays, setSkipDays] = useState<number[]>([]);
  const [buffer, setBuffer] = useState(false);
  const [weekly, setWeekly] = useState(false);
  const [dayIdx, setDayIdx] = useState(0);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
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

  const crowd0 = people.length;
  const minAvailable = attend === "all" || crowd0 < 3 ? crowd0 : attend === "half" ? Math.max(2, Math.ceil(crowd0 / 2)) : Math.min(crowd0, Math.max(2, Number(attend) || crowd0));
  const suggestions: Suggestion[] = useMemo(
    () => (weekly ? [] : suggestTimes(people, now, { duration, days, buffer: buffer ? 15 : 0, minAvailable, required, skipDays, earliest: notBefore, latest: notAfter, max: 6 })),
    [people, now, duration, days, buffer, weekly, minAvailable, required, skipDays, notBefore, notAfter],
  );
  const weeklySlots: WeeklySlot[] = useMemo(
    () => (weekly ? weeklyTimes(people, { duration, everyone: minAvailable >= crowd0, buffer: buffer ? 15 : 0, earliest: notBefore, latest: notAfter, max: 6 }) : []),
    [people, duration, minAvailable, crowd0, buffer, weekly, notBefore, notAfter],
  );
  const kindOf = KINDS.find((k) => k.id === kind)!;
  const pickKind = (id: KindId) => {
    const k = KINDS.find((x) => x.id === id)!;
    setKind(id); setDuration(k.minutes); setNotBefore(Math.max(k.from, 8 * 60)); setNotAfter(k.to);
  };
  const toggleRequired = (id: string) => setRequired((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  const toggleDay = (d: number) => setSkipDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]));
  const restricted = notBefore > Math.max(kindOf.from, 8 * 60) || notAfter < kindOf.to || skipDays.length > 0;
  const limited = notBefore > 8 * 60 || notAfter < 22 * 60 || skipDays.length > 0; // any limit at all, so "drop the limits" has something to drop

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(0, 8)));

  /** A campus event on at the same time, if there is one worth mentioning. */
  const eventAt = (start: Date, end: Date) => events.find((e) => e.status === "published" && !e.canceled && new Date(e.startsAt) < end && new Date(e.endsAt ?? new Date(new Date(e.startsAt).getTime() + 2 * 3600000)) > start);

  async function plan(start: Date, id: string) {
    setError("");
    const when = toLocalInput(start);
    // Things change while you read the list, so check once more that you are not already booked then.
    const clash = findConflict(when);
    if (clash) { setError(`You already have "${clash.title}" at that time. Pick another.`); setConfirm(null); return; }
    setMaking(true);
    if (groupId) {
      hangActions.createHangout(groupId, { title: kindOf.title, place: spot?.name ?? "Pick a spot", when });
      setMaking(false); setConfirm(null);
      haptic("success");
      notice.show({ icon: "calendar", title: "Hangout planned", message: "Everyone in the group can answer it now. Pick a place in the chat.", ms: 4000 });
      return;
    }
    const label = chosen.map((f) => f.name.split(" ")[0]).slice(0, 3).join(", ");
    const out = await makeGroupAndInvite({ name: label ? `${kindOf.title} with ${label}` : kindOf.title, friends: chosen, hangout: { title: kindOf.title, place: spot?.name ?? "Pick a spot", when } });
    setMaking(false); setConfirm(null);
    if (out.error) { setError(out.error); return; }
    haptic("success");
    notice.show({ icon: "calendar", title: "Plan made", message: out.invited.length ? `${out.invited.join(", ")} got an invite link. Pick a place in the group chat.` : "Pick a place in the group chat.", ms: 4500 });
    void id;
    nav("/app/chats?tab=groups");
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
        <StackedList
          title={title}
          subtitle={picked.length ? `with ${picked.map((id) => friends.find((f) => f.id === id)?.name.split(" ")[0]).filter(Boolean).slice(0, 3).join(", ")}${picked.length > 3 ? ` +${picked.length - 3}` : ""}` : "just you · pick friends"}
          people={chosen.map((f) => ({ name: f.name }))}
          items={friends}
          getKey={(f) => f.id}
          itemText={(f) => `${f.name} ${f.username ?? ""}`}
          empty="Add a friend first, then find a time that works for both of you."
          renderItem={(f) => (
            <button type="button" className="sl-row" aria-pressed={picked.includes(f.id)} onClick={() => toggle(f.id)}>
              <span className="sl-face" style={{ background: gradientFor(f.name) }} aria-hidden="true">{f.name.trim().slice(0, 1).toUpperCase()}</span>
              <span className="sl-name">{f.name}{f.username && <small>@{f.username}</small>}</span>
              <span className="sl-tick" aria-hidden="true"><Check size={13} /></span>
            </button>
          )}
        />
      )}
      {notSharing.length > 0 && <p className="muted sync-note"><b>Unknown:</b> {notSharing.join(", ")} {notSharing.length === 1 ? "has" : "have"} not shared free time, so Orbit cannot tell when they are free and leaves them out. Ask them to turn on sharing, or plan it and let them answer.</p>}

      <div className="sync-opts">
        <div className="sync-row">
          <span className="sync-k" id="sy-what">What</span>
          <GradientMenu
            label="What you are planning"
            className="sync-kinds"
            items={KINDS.map((k): GMItem => ({ key: k.id, label: KIND_LOOK[k.id].short, icon: KIND_LOOK[k.id].icon, tone: KIND_LOOK[k.id].tone, on: kind === k.id, onClick: () => pickKind(k.id) }))}
          />
        </div>
        <div className="sync-row">
          <span className="sync-k">How long</span>
          <Segmented label="How long" options={LENGTHS.map((l) => ({ value: l.m, label: l.l }))} value={duration} onChange={setDuration} />
        </div>
        {!weekly && (
          <div className="sync-row">
            <span className="sync-k">How soon</span>
            <Segmented label="How soon" options={WINDOWS.map((w) => ({ value: w.d, label: w.l }))} value={days} onChange={setDays} />
          </div>
        )}
        <details className="sync-adv">
          <summary>More{restricted || attend !== "all" || required.length > 0 ? " (set)" : ""}</summary>
          {crowd > 2 && (
            <div className="sync-opt"><span id="sy-att">Who has to be free</span>
              <Dropdown
                label="Who has to be free"
                value={attend}
                onChange={setAttend}
                options={[{ value: "all", label: "Everyone" }, { value: "half", label: "At least half" }, ...Array.from({ length: Math.max(0, crowd - 2) }, (_, i) => i + 2).map((n) => ({ value: String(n), label: `At least ${n} people` }))]}
              />
            </div>
          )}
          {!given && picked.length > 0 && (
            <div className="sync-opt"><span id="sy-req">Must be there</span>
              <div className="chip-row" role="group" aria-labelledby="sy-req">{chosen.map((f) => <button key={f.id} type="button" className="chip-btn" aria-pressed={required.includes(f.id)} onClick={() => toggleRequired(f.id)}>{required.includes(f.id) && <Star size={11} aria-hidden="true" />}{f.name.split(" ")[0]}</button>)}</div>
            </div>
          )}
          <div className="sync-bar">
            <div className="sync-opt"><span>Not before</span>
              <Dropdown label="Not before" value={notBefore} onChange={setNotBefore} options={[...NOT_BEFORE, ...(NOT_BEFORE.some((o) => o.m === notBefore) ? [] : [{ m: notBefore, l: timeLabel(notBefore) }])].sort((x, y) => x.m - y.m).map((o) => ({ value: o.m, label: o.l }))} />
            </div>
            <div className="sync-opt"><span>Not after</span>
              <Dropdown label="Not after" value={notAfter} onChange={setNotAfter} options={[...NOT_AFTER, ...(NOT_AFTER.some((o) => o.m === notAfter) ? [] : [{ m: notAfter, l: timeLabel(notAfter) }])].sort((x, y) => y.m - x.m).map((o) => ({ value: o.m, label: o.l }))} />
            </div>
          </div>
          <div className="sync-opt"><span id="sy-skip">Skip days</span>
            <div className="chip-row" role="group" aria-labelledby="sy-skip">{WEEK.map((d) => <button key={d} type="button" className="chip-btn" aria-pressed={skipDays.includes(d)} aria-label={DAY_NAMES[d]} onClick={() => toggleDay(d)}>{DAY_NAMES[d].slice(0, 3)}</button>)}</div>
          </div>
          <div className="sync-opt"><span id="sy-where">Where (optional)</span>
            <Dropdown label="Where" value={whereId} onChange={setWhereId} options={[{ value: "", label: "Anywhere" }, ...places.filter((p) => p.category !== "transit").slice(0, 80).map((p) => ({ value: p.id, label: p.name }))]} />
            {spot && <small className="muted">{travel && travel.longest > 0 ? `Leaves up to ${travel.longest} min around your classes to walk to ${spot.name}.` : `Your classes are close to ${spot.name}.`}</small>}
          </div>
          <div className="sync-toggles">
            <label><input type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} /> Repeats every week</label>
            <label><input type="checkbox" checked={buffer} onChange={(e) => setBuffer(e.target.checked)} /> Leave 15 min around classes</label>
          </div>
        </details>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {!weekly && (
        suggestions.length === 0
          ? (
            <div className="sync-none">
              <p><b>No {duration >= 60 ? span(duration) : `${duration} min`} time works{crowd > 1 ? " for everyone" : ""} in this window.</b> Try one of these:</p>
              <div className="sync-alts">
                {duration > 30 && <button type="button" className="btn sm" onClick={() => setDuration(duration > 60 ? 60 : 30)}>Shorten to {duration > 60 ? "1 hr" : "30 min"}</button>}
                {days < 14 && <button type="button" className="btn sm" onClick={() => setDays(days < 7 ? 7 : 14)}>Look {days < 7 ? "a week" : "two weeks"} ahead</button>}
                {crowd > 2 && attend === "all" && <button type="button" className="btn sm" onClick={() => setAttend("half")}>Allow some to miss it</button>}
                {limited && <button type="button" className="btn sm" onClick={() => { setNotBefore(8 * 60); setNotAfter(22 * 60); setSkipDays([]); }}>Drop the time limits</button>}
                {required.length > 0 && <button type="button" className="btn sm" onClick={() => setRequired([])}>Nobody is a must</button>}
              </div>
            </div>
          )
          : <SweepUl className="sync-list">
              {(showAll ? suggestions : suggestions.slice(0, FIRST)).map((s) => {
                const ev = eventAt(s.start, s.end);
                const id = s.start.toISOString();
                return (
                  <SweepLi key={id} data-best={s.best ? "" : undefined}>
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
                  </SweepLi>
                );
              })}
            </SweepUl>
      )}

      {weekly && (
        weeklySlots.length === 0
          ? <p className="muted">No time repeats every week for everyone. Try a shorter length.</p>
          : <SweepUl className="sync-list">
              {weeklySlots.map((w, i) => {
                const start = nextOccurrence(w.weekday, w.start, now);
                const id = `w${w.weekday}-${w.start}`;
                return (
                  <SweepLi key={id} data-best={i === 0 ? "" : undefined}>
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
                  </SweepLi>
                );
              })}
            </SweepUl>
      )}

      {!weekly && (suggestions.length > FIRST || crowd > 0) && (
        <div className="sync-pills">
          {suggestions.length > FIRST && (
            <button type="button" className="pill-btn" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
              {showAll ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}{showAll ? "Fewer times" : `${suggestions.length - FIRST} more time${suggestions.length - FIRST === 1 ? "" : "s"}`}
            </button>
          )}
          {crowd > 0 && (
            <button type="button" className="pill-btn" aria-expanded={gridOpen} onClick={() => setGridOpen((v) => !v)}>
              <CalendarDays size={14} aria-hidden="true" />{gridOpen ? "Hide the day" : "Everyone's day"}
            </button>
          )}
        </div>
      )}
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
