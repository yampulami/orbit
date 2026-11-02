import { Suspense, lazy, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import DayStrip from "../components/DayStrip";
import { useIsPhone } from "../lib/phone";
import DayAgenda from "../components/DayAgenda";
import UpcomingList from "../components/UpcomingList";
// The month calendar and the week board are big: they are only loaded on a larger screen, and a phone gets a day strip and a list instead.
const Calendar = lazy(() => import("../components/Calendar"));
const WeekBoard = lazy(() => import("../components/WeekBoard"));
import ClassesPanel from "../components/ClassesPanel";
import SyncLink from "../components/SyncLink";
import { feedApi as api, type Row } from "../lib/feedData";
import { isVisible, useHang, YOU } from "../lib/hangouts";

export default function Plans() {
  const phone = useIsPhone();
  const [showClasses, setShowClasses] = useState(false);
  const [posts, setPosts] = useState<Row[]>([]);
  const loc = useLocation();
  const asked = (loc.state as { day?: string } | null)?.day ?? null;
  const [day, setDay] = useState<string>(asked ?? new Date().toDateString());
  useEffect(() => { if (asked) setDay(asked); }, [asked, loc.key]);
  // One sentence about the day you are looking at.
  const { groups, hangouts } = useHang();
  const planned = hangouts.filter((h) => isVisible(h, groups) && !h.canceled && new Date(h.when).toDateString() === day);
  const daysAway = Math.round((new Date(day).getTime() - new Date(new Date().toDateString()).getTime()) / 864e5);
  const waiting = daysAway < 0 ? 0 : planned.filter((h) => !h.rsvps[YOU]).length;
  const when = daysAway === 0 ? "today" : daysAway === 1 ? "tomorrow" : daysAway === -1 ? "yesterday" : new Date(day).toLocaleDateString(undefined, { weekday: "long" });
  const head = planned.length === 0 ? `Nothing planned ${when}` : `${planned.length} plan${planned.length === 1 ? "" : "s"} ${when}${waiting > 0 ? `, ${waiting} need${waiting === 1 ? "s" : ""} your answer` : ""}`;
  useEffect(() => { if (!phone) api.list().then(setPosts).catch(() => setPosts([])); }, [phone]);

  if (phone) {
    return (
      <div className="page plans-phone">
        <h1 className="sr">Plans</h1>
        <DayStrip day={day} onDay={setDay} />
        <DayAgenda day={day} />
        <UpcomingList limit={4} />
        <button type="button" className="btn wide-btn" aria-expanded={showClasses} onClick={() => setShowClasses((v) => !v)}>{showClasses ? "Hide class schedule" : "Class schedule"}</button>
        {showClasses && <ClassesPanel />}
        <SyncLink />
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="sr">Plans</h1>
      <h2 className="plans-head">{head}</h2>
      <div className="plans2">
        <div className="plans-col">
          <Suspense fallback={<div className="skeleton sk-card" />}><Calendar posts={posts} day={day} onDay={(k) => setDay(k ?? new Date().toDateString())} details={false} /></Suspense>
          <UpcomingList limit={3} />
          <ClassesPanel />
          <SyncLink />
        </div>
        <div className="plans-main">
          <DayAgenda day={day} />
          <Suspense fallback={<div className="skeleton sk-card" />}><WeekBoard day={day} onDay={(k) => setDay(k ?? new Date().toDateString())} /></Suspense>
        </div>
      </div>
    </div>
  );
}
