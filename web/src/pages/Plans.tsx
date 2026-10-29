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
import FreeTimePanel from "../components/FreeTimePanel";
import { feedApi as api, type Row } from "../lib/feedData";

export default function Plans() {
  const phone = useIsPhone();
  const [showClasses, setShowClasses] = useState(false);
  const [posts, setPosts] = useState<Row[]>([]);
  const loc = useLocation();
  const asked = (loc.state as { day?: string } | null)?.day ?? null;
  const [day, setDay] = useState<string>(asked ?? new Date().toDateString());
  useEffect(() => { if (asked) setDay(asked); }, [asked, loc.key]);
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
        <FreeTimePanel />
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="sr">Plans</h1>
      <div className="plans2">
        <div className="plans-col">
          <Suspense fallback={<div className="skeleton sk-card" />}><Calendar posts={posts} day={day} onDay={(k) => setDay(k ?? new Date().toDateString())} details={false} /></Suspense>
          <UpcomingList limit={5} />
          <ClassesPanel />
          <FreeTimePanel />
        </div>
        <div className="plans-main">
          <DayAgenda day={day} />
          <Suspense fallback={<div className="skeleton sk-card" />}><WeekBoard day={day} onDay={(k) => setDay(k ?? new Date().toDateString())} /></Suspense>
        </div>
      </div>
    </div>
  );
}
