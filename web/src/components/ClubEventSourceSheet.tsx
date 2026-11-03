import { useEffect } from "react";
import { X } from "lucide-react";
import ClubEventSource from "./ClubEventSource";
import { type Org } from "../lib/campusOrgs";

/** Its own window, opened from the club's menu: bring in events from the club's website or calendar. */
export default function ClubEventSourceSheet({ org, onClose }: { org: Org; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal cinfo" role="dialog" aria-modal="true" aria-label="Import events">
        <header className="cinfo-head">
          <h2 className="cinfo-title">Import events</h2>
          <button type="button" className="ac-icon" aria-label="Close" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </header>
        <ClubEventSource key={org.id + org.eventsUrl} org={org} />
      </div>
    </div>
  );
}
