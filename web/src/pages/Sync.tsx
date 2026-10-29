import { Link, useLocation } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import FreeTimePanel from "../components/FreeTimePanel";
import OrbitView from "../components/OrbitView";

/** Schedule Sync on its own page: who can see when you are free, and finding a time that works for you and your people. */
export default function Sync() {
  const syncWith = (useLocation().state as { syncWith?: string[] } | null)?.syncWith;
  return (
    <div className="page sync-page">
      <h1 className="sr">Schedule sync</h1>
      <FreeTimePanel preselect={syncWith} />
      <OrbitView />
      <p className="sync-foot muted"><CalendarDays size={14} aria-hidden="true" /> Your classes and reminders come from <Link to="/app/plans">Plans</Link>, where you can add or import them.</p>
    </div>
  );
}
