import { Suspense, lazy, useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import DayStrip from "../components/DayStrip";
import { useIsPhone } from "../lib/phone";
import DayAgenda from "../components/DayAgenda";
import UpcomingList from "../components/UpcomingList";
// The month calendar and the week board are big: they are only loaded on a larger screen, and a phone gets a day strip and a list instead.
const Calendar = lazy(() => import("../components/Calendar"));
const WeekBoard = lazy(() => import("../components/WeekBoard"));
// "Find a time" is the other half of this page: it loads only when it is opened.
const FindATime = lazy(() => import("./Sync"));
import ClassesPanel from "../components/ClassesPanel";
import { feedApi as api, type Row } from "../lib/feedData";
import { isVisible, useHang, YOU } from "../lib/hangouts";

export default function Plans() {
  const phone = useIsPhone();
  const [showClasses, setShowClasses] = useState(false);
  const [posts, setPosts] = useState<Row[]>([]);
  const loc = useLocation();
  // Two halves of one page: what is planned, and finding a time with friends. A link that names friends to plan with opens the second.
  const [params, setParams] = useSearchParams();
  const tab: "plans" | "free" = params.get("tab") === "free" || (loc.state as { syncWith?: string[] } | null)?.syncWith ? "free" : "plans";
  const goTab = (t: "plans" | "free") => setParams(t === "free" ? { tab: "free" } : {}, { replace: true, state: undefined });
  const asked = (loc.state as { day?: string } | null)?.day ?? null;
  const [day, setDay] = useState<string>(asked ?? new Date().toDateString());
  useEffect(() => { if (asked) setDay(asked); }, [asked, loc.key]);
  // One sentence about the day you are looking at.
  const { groups, hangouts } = useHang();
  const planned = hangouts.filter((h) => isVisible(h, groups) && !h.canceled && new Date(h.when).toDateString() === day);
  const daysAway = Math.round((new Date(day).getTime() - new Date(new Date().toDateString()).getTime()) / 864e5);
  const waiting = daysAway < 0 ? 0 : planned.filter((h) => !h.rsvps[YOU]).length;
  const when = daysAway === 0 ? "today" : daysAway === 1 ? "tomorrow" : daysAway === -1 ? "yesterday" : new Date(day).toLocaleDateString(undefined, { weekday: "long" });
  // Lead with the plan that comes next (or the first of the day), the way the Feed does.
  const byTime = [...planned].sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime());
  const lead = (daysAway === 0 ? byTime.find((h) => new Date(h.when).getTime() > Date.now()) : undefined) ?? byTime[0];
  const clock = lead ? new Date(lead.when).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
  const head = !lead ? `Nothing planned ${when}` : `${lead.title} ${when} at ${clock}${waiting > 0 ? `, ${waiting === 1 ? "waiting for your answer" : `${waiting} plans wait for your answer`}` : ""}`;
  // J and K step through the days, T jumps back to today (not while typing).
  useEffect(() => {
    if (phone || tab === "free") return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || el?.closest?.("input,textarea,select,[contenteditable=true]")) return;
      const step = e.key === "j" ? 1 : e.key === "k" ? -1 : 0;
      if (step) setDay((d) => new Date(new Date(d).getTime() + step * 864e5).toDateString());
      else if (e.key === "t") setDay(new Date().toDateString());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phone, tab]);
  useEffect(() => { if (!phone) api.list().then(setPosts).catch(() => setPosts([])); }, [phone]);

  const switcher = (
    <div className="chats-switch plans-switch" role="tablist" aria-label="Plans">
      <button type="button" role="tab" aria-selected={tab === "plans"} onClick={() => goTab("plans")}>Plans</button>
      <button type="button" role="tab" aria-selected={tab === "free"} onClick={() => goTab("free")}>Find a time</button>
    </div>
  );

  if (tab === "free") {
    return (
      <div className={"page" + (phone ? " plans-phone" : "")}>
        <h1 className="sr">Find a time</h1>
        {switcher}
        <Suspense fallback={<div className="skeleton sk-card" aria-busy="true" />}><FindATime /></Suspense>
      </div>
    );
  }

  if (phone) {
    return (
      <div className="page plans-phone">
        <h1 className="sr">Plans</h1>
        {switcher}
        <DayStrip day={day} onDay={setDay} />
        <DayAgenda day={day} />
        <UpcomingList limit={4} />
        <button type="button" className="btn wide-btn" aria-expanded={showClasses} onClick={() => setShowClasses((v) => !v)}>{showClasses ? "Hide class schedule" : "Class schedule"}</button>
        {showClasses && <ClassesPanel />}
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="sr">Plans</h1>
      {switcher}
      <h2 className="plans-head">{head}</h2>
      <div className="plans2">
        <div className="plans-col">
          <Suspense fallback={<div className="skeleton sk-card" />}><Calendar posts={posts} day={day} onDay={(k) => setDay(k ?? new Date().toDateString())} details={false} /></Suspense>
          <UpcomingList limit={3} />
          <p className="rail-links">
            <button type="button" className="rm-link" aria-expanded={showClasses} onClick={() => setShowClasses((v) => !v)}>Class schedule</button>
            {" · "}<button type="button" className="rm-link" onClick={() => goTab("free")}>Find a time with friends</button>
          </p>
          {showClasses && <ClassesPanel startOpen />}
        </div>
        <div className="plans-main">
          <DayAgenda day={day} />
          <Suspense fallback={<div className="skeleton sk-card" />}><WeekBoard day={day} onDay={(k) => setDay(k ?? new Date().toDateString())} /></Suspense>
        </div>
      </div>
      <p className="plans-keys">J and K change the day, T goes back to today.</p>
    </div>
  );
}
