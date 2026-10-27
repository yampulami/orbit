import { useState } from "react";
import { ChevronDown, UserCheck } from "lucide-react";
import { useMyCheckins } from "../lib/checkin";
import { eventWhen } from "./EventCard";
import RichText from "./RichText";

/** Your private record of the campus events you checked in to. Only you can see it. */
export default function AttendedList() {
  const { list } = useMyCheckins();
  const [open, setOpen] = useState(false);
  if (list.length === 0) return null;
  return (
    <section className="attended" aria-label="Events you attended">
      <button type="button" className="cevent-help" aria-expanded={open} onClick={() => setOpen((v) => !v)}><UserCheck size={15} aria-hidden="true" /> Events you attended ({list.length}) <ChevronDown size={15} aria-hidden="true" className="chev" /></button>
      {open && (
        <>
          <p className="muted">Only you can see this.</p>
          <ul>{list.map((c) => <li key={c.event_id}><strong><RichText text={c.title} /></strong><span className="muted">{c.host ? `${c.host} · ` : ""}{eventWhen({ startsAt: c.starts_at })}{c.method === "manual" ? " · checked in by the host" : ""}</span></li>)}</ul>
        </>
      )}
    </section>
  );
}
