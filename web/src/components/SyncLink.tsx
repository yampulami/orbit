import { Link } from "react-router-dom";
import { CalendarClock, ChevronRight } from "lucide-react";

/** On Plans: a way into Find a time. */
export default function SyncLink() {
  return (
    <Link to="/app/plans?tab=free" className="sync-link">
      <span className="sl-ic" aria-hidden="true"><CalendarClock size={18} /></span>
      <span className="sl-t"><b>Schedule sync</b><small>Find a time that works for your friends</small></span>
      <ChevronRight size={16} className="sl-chev" aria-hidden="true" />
    </Link>
  );
}
