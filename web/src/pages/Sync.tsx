import { Link, useLocation } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import FreeTimePanel from "../components/FreeTimePanel";

/** Find a time: who can see when you are free, and finding a time that works for you and your people. It lives on the Plans page, under "Find a time". */
export default function Sync() {
  const syncWith = (useLocation().state as { syncWith?: string[] } | null)?.syncWith;
  return (
    <div className="sync-page">
      <h2 className="sr">Find an hour you are both free</h2>
      <FreeTimePanel preselect={syncWith} />
      <p className="sync-foot muted"><CalendarDays size={14} aria-hidden="true" /><span>Your classes and reminders are on the Plans tab, where you can add or import them.</span></p>
    </div>
  );
}
