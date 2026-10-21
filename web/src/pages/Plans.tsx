import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Calendar from "../components/Calendar";
import DayAgenda from "../components/DayAgenda";
import UpcomingList from "../components/UpcomingList";
import WeekBoard from "../components/WeekBoard";
import { feedApi as api, type Row } from "../lib/feedData";

export default function Plans() {
  const [posts, setPosts] = useState<Row[]>([]);
  const loc = useLocation();
  const asked = (loc.state as { day?: string } | null)?.day ?? null;
  const [day, setDay] = useState<string>(asked ?? new Date().toDateString());
  useEffect(() => { if (asked) setDay(asked); }, [asked, loc.key]);
  useEffect(() => { api.list().then(setPosts).catch(() => setPosts([])); }, []);

  return (
    <div className="page">
      <h1 className="sr">Plans</h1>
      <div className="plans2">
        <div className="plans-col">
          <Calendar posts={posts} day={day} onDay={(k) => setDay(k ?? new Date().toDateString())} details={false} />
          <UpcomingList limit={5} />
        </div>
        <div className="plans-main">
          <DayAgenda day={day} />
          <WeekBoard day={day} onDay={(k) => setDay(k ?? new Date().toDateString())} />
        </div>
      </div>
    </div>
  );
}
