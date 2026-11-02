import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMyBusy } from "../lib/useMyBusy";
import { useFriends } from "../lib/friends";
import { isVisible, useHang, YOU } from "../lib/hangouts";
import { useReminders, ymd } from "../lib/reminders";
import { useCampusEvents } from "../lib/campusEvents";
import { loadFriendFree } from "../lib/availability";
import { busyOn, describeBusy, type BusyItem } from "../lib/myBusy";
import { freeNow, span, type Person } from "../lib/freeTime";
import { clock } from "../lib/dayWords";

/** The bar shows 7 AM to 11 PM. */
const FROM = 7 * 60, TO = 23 * 60;
const pct = (min: number) => `${(Math.min(Math.max(min - FROM, 0), TO - FROM) / (TO - FROM)) * 100}%`;
const minutes = (d: Date) => d.getHours() * 60 + d.getMinutes();
const KEPT: BusyItem["kind"][] = ["class", "hangout", "event"];
const byStart = (a: BusyItem, b: BusyItem) => a.start.getTime() - b.start.getTime();

/** The top of the Feed: what your next hour looks like, said in plain words, with the day drawn underneath (classes solid, plans and events in orange, a needle for now).
 *  From 10 PM to 6 AM it talks about the coming day instead, and always says "Tomorrow", so the word does not flip at midnight. */
export default function NowHeader() {
  const { friends } = useFriends();
  const { groups, hangouts } = useHang();
  const reminders = useReminders();
  const { events } = useCampusEvents();
  const [now, setNow] = useState(() => new Date());
  const [shared, setShared] = useState<Person[]>([]);
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(t); }, []);

  const key = friends.map((f) => f.id).join(",");
  useEffect(() => {
    let live = true;
    if (friends.length === 0) { setShared([]); return; }
    void loadFriendFree(friends).then((r) => { if (live) setShared(r.sharing); });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const { me, input, today } = useMyBusy(now);
  const late = now.getHours() >= 22 || now.getHours() < 6;
  // At night the day shown is the next one a student will be awake for.
  const shownDay = late ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + (now.getHours() >= 22 ? 1 : 0)) : now;
  const items = (late ? busyOn(input, shownDay) : today).filter((i) => KEPT.includes(i.kind)).sort(byStart);
  const nowMin = minutes(now);
  // A plan nobody has answered yet is drawn on the bar but is not "your" plan in the headline until you say yes.
  const unanswered = (i: BusyItem) => i.kind === "hangout" && !hangouts.some((h) => h.title === i.label && new Date(h.when).getTime() === i.start.getTime() && h.rsvps[YOU] === "yes");
  const confirmed = items.filter((i) => !unanswered(i));
  // What needs you when nothing is confirmed: plans nobody has answered yet (the same ones "Plans waiting on you" lists) and tasks past their day.
  const toAnswer = hangouts.filter((h) => isVisible(h, groups) && !h.canceled && new Date(h.when).getTime() > now.getTime() - 3 * 3600_000 && !h.rsvps[YOU]).length;
  const overdue = reminders.filter((r) => !r.done && r.date < ymd(now)).length;
  const needs = [toAnswer > 0 ? `${toAnswer} plan${toAnswer === 1 ? "" : "s"} to answer` : "", overdue > 0 ? `${overdue} overdue` : ""].filter(Boolean);
  const waiting = !late && items.some((i) => unanswered(i) && i.end > now);
  const inside = late ? undefined : confirmed.find((i) => i.start <= now && i.end > now);
  const nextClass = late ? undefined : items.find((i) => i.kind === "class" && i.start > now);
  const free = late ? null : freeNow(me, now);
  const open = free && free.minutes >= 25 ? free : null;

  let head: string, sub: string | null = null, prompt = false;
  if (late) {
    const first = confirmed[0];
    head = first ? `Tomorrow: ${first.label} at ${clock(first.start)}` : "Nothing on your schedule tomorrow";
  } else if (confirmed.length === 0) {
    head = needs.length ? needs.join(" · ") : "Nothing on your schedule today";
    sub = needs.length ? "Nothing else is confirmed for today." : "Add your classes to see your gaps.";
    prompt = needs.length === 0;
  } else if (inside) {
    head = `${inside.label} until ${clock(inside.end)}`;
    const after = freeNow(me, inside.end);
    sub = after && after.minutes >= 25 ? `Free ${clock(inside.end)} to ${clock(after.until)}` : "Back to back after that.";
  } else if (open) {
    head = `Free ${clock(now)} to ${clock(open.until)}`;
    sub = nextClass ? `${nextClass.label} starts in ${span(Math.max(1, Math.round((nextClass.start.getTime() - now.getTime()) / 60000)))}.` : "Nothing else on your schedule today.";
  } else {
    const next = confirmed.find((i) => i.start > now);
    head = next ? `${next.label} at ${clock(next.start)}` : waiting ? "Nothing else confirmed today" : "Done for today";
    sub = next ? `In ${span(Math.max(1, Math.round((next.start.getTime() - now.getTime()) / 60000)))}.` : null;
  }

  const gapEnd = open ? open.until.getTime() : 0;
  const inGap = open
    ? [...events.filter((e) => e.status === "published" && !e.canceled && new Date(e.startsAt) >= now && new Date(e.startsAt).getTime() < gapEnd).map((e) => ({ title: e.title, at: new Date(e.startsAt) })),
       ...hangouts.filter((h) => !h.canceled && new Date(h.when) >= now && new Date(h.when).getTime() < gapEnd).map((h) => ({ title: h.title, at: new Date(h.when) }))]
      .sort((a, b) => a.at.getTime() - b.at.getTime())[0]
    : undefined;
  const alsoFree = open ? shared.filter((p) => (freeNow(p, now)?.minutes ?? 0) >= 25) : [];
  const first = (p: Person) => p.name.split(" ")[0];
  const needle = !late && nowMin >= FROM && nowMin <= TO;
  const daySays = items.length ? items.map((i) => describeBusy(i) + (unanswered(i) ? " (waiting for your answer)" : "")).join("; ") : "nothing scheduled";

  return (
    <section className="now" aria-labelledby="now-h">
      <h2 id="now-h" className="now-head">{head}</h2>
      {sub && <p className="now-sub">{sub}{prompt && <> <Link to="/app/plans">Add classes</Link></>}</p>}
      {inGap && <p className="now-sub">{inGap.title} at {clock(inGap.at)} falls in this gap.</p>}
      {alsoFree.length > 0 && <p className="now-sub">{alsoFree.slice(0, 3).map(first).join(", ")}{alsoFree.length > 3 ? ` and ${alsoFree.length - 3} more` : ""} {alsoFree.length === 1 ? "is" : "are"} free too.</p>}

      {items.length > 0 && <><div className="now-bar" role="img" aria-label={`${late ? "Tomorrow" : "Your day"} from 7 AM to 11 PM: ${daySays}.${needle ? " The marker shows where it is now." : ""}`}>
        {items.map((i, n) => (
          <span key={n} className={"now-seg " + i.kind + (unanswered(i) ? " pending" : "")} style={{ left: pct(minutes(i.start)), width: `max(3px, calc(${pct(minutes(i.end))} - ${pct(minutes(i.start))}))` }} />
        ))}
        {needle && <span className="now-needle" style={{ left: pct(nowMin) }} />}
      </div>
      <div className="now-ticks" aria-hidden="true"><span>7 AM</span><span>Noon</span><span>5 PM</span><span>11 PM</span></div></>}
      {items.length > 0 && (
        <p className="now-key" aria-hidden="true">
          {items.some((i) => i.kind === "class") && <span><i className="class" />Class</span>}
          {items.some((i) => i.kind !== "class" && !unanswered(i)) && <span><i className="plan" />Plan or event</span>}
          {items.some(unanswered) && <span><i className="plan pending" />Waiting for your answer</span>}
          {needle && <span><i className="needle" />Now</span>}
        </p>
      )}

      <div className="now-acts">
        {alsoFree.length > 0
          ? <Link className="btn now-main" to="/app/sync" state={{ syncWith: alsoFree.map((p) => p.id) }}>Plan with {first(alsoFree[0])}{alsoFree.length > 1 ? ` +${alsoFree.length - 1}` : ""}</Link>
          : <Link className="btn now-main" to="/app/sync">Find a time</Link>}
        <button type="button" className="btn" aria-label="Ask the Orbit assistant" onClick={() => window.dispatchEvent(new CustomEvent("orbit-assistant-open"))}>Ask Orbit</button>
      </div>
    </section>
  );
}
