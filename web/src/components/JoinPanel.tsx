import { useState } from "react";
import { Check, Clock, UserPlus, X } from "lucide-react";
import { orgActions, type Org } from "../lib/campusOrgs";
import { notice } from "../lib/notice";
import JoinSheet from "./JoinSheet";

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return !iso ? "" : m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

/** For someone who is not an officer: ask to join, see that the request is waiting, or leave. */
export function JoinButton({ org }: { org: Org }) {
  const [asking, setAsking] = useState(false);
  if (org.status !== "active" || org.myJoin === "officer") return null;
  if (org.myJoin === "member") return <div className="join-row"><span className="ebadge student"><Check size={12} aria-hidden="true" /> You are in this club</span><button type="button" className="link-btn" onClick={() => void orgActions.leaveClub(org.id)}>Leave</button></div>;
  if (org.myJoin === "pending") return <div className="join-row"><span className="ebadge wait"><Clock size={12} aria-hidden="true" /> Waiting for an officer to answer</span><button type="button" className="link-btn" onClick={() => void orgActions.leaveClub(org.id)}>Take back</button></div>;
  if (org.kind === "circle") {
    return <div className="join-row"><button type="button" className="btn sm primary" onClick={async () => { const r = await orgActions.requestJoin(org.id, ""); if (!r) notice.show({ icon: "calendar", title: `You joined ${org.name}`, message: "It is a casual circle, so you are in right away.", ms: 3500 }); }}><UserPlus size={16} aria-hidden="true" /> Join circle</button></div>;
  }
  return (
    <div className="join-row">
      <button type="button" className="btn sm primary" onClick={() => setAsking(true)}><UserPlus size={15} aria-hidden="true" /> Ask to join</button>
      {org.myJoin === "declined" && <span className="muted">Your last request was not approved. You can ask again.</span>}
      <JoinSheet open={asking} name={org.name} onClose={() => setAsking(false)} onSend={async (note) => { const r = await orgActions.requestJoin(org.id, note); if (!r) { notice.show({ icon: "calendar", title: "Request sent", message: `${org.name}'s officers will look at it and you will get a notification.`, ms: 4500 }); setAsking(false); } }} />
    </div>
  );
}

/** For officers and coordinators: the people waiting to get in. */
export function JoinRequests({ org }: { org: Org }) {
  if (org.requests.length === 0) return null;
  return (
    <section className="club-section" aria-label="Join requests">
      <h2>Join requests <span className="rem-count">{org.requests.length}</span></h2>
      <ul className="club-members">
        {org.requests.map((r) => (
          <li key={r.id} className="join-req">
            <div className="join-req-main"><span className="club-member-name">{r.name}</span><span className="muted">{ago(r.at)}</span>{r.message && <span className="join-req-msg">“{r.message}”</span>}</div>
            <div className="htools-row">
              <button type="button" className="btn primary" onClick={() => { void orgActions.decideJoin(org.id, r.id, true); notice.show({ icon: "calendar", title: `${r.name} is in`, message: "They have been told.", ms: 3000 }); }}><Check size={15} aria-hidden="true" /> Let in</button>
              <button type="button" className="btn" onClick={() => void orgActions.decideJoin(org.id, r.id, false)}><X size={15} aria-hidden="true" /> Decline</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
