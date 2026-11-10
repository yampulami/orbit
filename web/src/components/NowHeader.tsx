import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMyBusy } from "../lib/useMyBusy";
import { useFriends } from "../lib/friends";
import { hangActions, isVisible, useHang, YOU, type Hangout } from "../lib/hangouts";
import { undo } from "../lib/undo";
import { leadPlan } from "../lib/leadPlan";
import { useReminders, ymd } from "../lib/reminders";
import { useCampusEvents } from "../lib/campusEvents";
import { loadFriendFree } from "../lib/availability";
import { busyOn, describeBusy, type BusyItem } from "../lib/myBusy";
import { freeNow, span, type Person } from "../lib/freeTime";
import { clock, dayWord } from "../lib/dayWords";

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
  const pending = hangouts.filter((h) => isVisible(h, groups) && !h.canceled && new Date(h.when).getTime() > now.getTime() - 3 * 3600_000 && !h.rsvps[YOU]).sort((a, b) => a.when.localeCompare(b.when));
  // The plan that needs you first, when it comes before anything you have confirmed on the day shown.
  const nextConfirmed = confirmed.find((i) => i.end > now)?.start;
  const lead: Hangout | undefined = !(late ? undefined : confirmed.find((i) => i.start <= now && i.end > now)) && pending[0] && new Date(pending[0].when).toDateString() === shownDay.toDateString() && (!nextConfirmed || new Date(pending[0].when) < nextConfirmed) ? pending[0] : undefined;
  const leadId = lead?.id ?? null;
  useEffect(() => { leadPlan.set(leadId); return () => leadPlan.set(null); }, [leadId]);
  const answer = (h: Hangout, a: "yes" | "no") => {
    hangActions.setRsvp(h.id, a);
    undo.show(a === "yes" ? `You’re in for “${h.title}”` : `You said you can’t make “${h.title}”`, { onUndo: () => hangActions.setRsvp(h.id, null), commit: () => {} });
  };
  const toAnswer = hangouts.filter((h) => isVisible(h, groups) && !h.canceled && new Date(h.when).getTime() > now.getTime() - 3 * 3600_000 && !h.rsvps[YOU]).length;
  const overdue = reminders.filter((r) => !r.done && r.date < ymd(now)).length;
  const needs = [toAnswer > 0 ? `${toAnswer} plan${toAnswer === 1 ? "" : "s"} to answer` : "", overdue > 0 ? `${overdue} overdue` : ""].filter(Boolean);
  const waiting = !late && items.some((i) => unanswered(i) && i.end > now);
  const inside = late ? undefined : confirmed.find((i) => i.start <= now && i.end > now);
  const nextClass = late ? undefined : items.find((i) => i.kind === "class" && i.start > now);
  const free = late ? null : freeNow(me, now);
  const open = free && free.minutes >= 25 ? free : null;

  let head: string, sub: string | null = null, prompt = false;
  if (lead) {
    const d = new Date(lead.when);
    head = `${late || dayWord(d, now) !== "Today" ? `${dayWord(d, now)}: ` : ""}${lead.title} at ${clock(d)}`;
  } else if (late) {
    const first = confirmed[0];
    head = first ? `Tomorrow: ${first.label} at ${clock(first.start)}` : "Nothing on your schedule tomorrow";
  } else if (confirmed.length === 0) {
    // The plans waiting for an answer are counted once, in the "need your answer" line below, not here as well.
    head = overdue > 0 ? `${overdue} overdue` : "Nothing on your schedule today";
    sub = toAnswer > 0 ? "Plans from friends need your answer below." : overdue > 0 ? "Nothing else is confirmed for today." : "Add your classes to see your gaps.";
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
      {lead && (
        <p className="now-sub">Waiting for your answer
          <button type="button" className="now-ans yes" onClick={() => answer(lead, "yes")}>I’m in</button>
          <button type="button" className="now-ans" onClick={() => answer(lead, "no")}>Can’t</button>
          {toAnswer > 1 && <span className="now-more"> · {toAnswer - 1} more below</span>}
        </p>
      )}
      {!lead && !late && toAnswer > 0 && confirmed.length > 0 && <p className="now-sub">{toAnswer} plan{toAnswer === 1 ? "" : "s"} from friends need your answer below.</p>}
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
          ? <Link className="btn now-main" to="/app/plans?tab=free" state={{ syncWith: alsoFree.map((p) => p.id) }}>Plan with {first(alsoFree[0])}{alsoFree.length > 1 ? ` +${alsoFree.length - 1}` : ""}</Link>
          : <Link className="btn now-main" to="/app/plans?tab=free">Find a time</Link>}
        <button type="button" className="btn quiet" aria-label="Ask the Orbit assistant" onClick={() => window.dispatchEvent(new CustomEvent("orbit-assistant-open"))}>Ask Orbit</button>
      </div>
    </section>
  );
}
