import { useEffect, useRef, useState } from "react";
import { Check, Inbox } from "lucide-react";
import { Link } from "react-router-dom";
import { orgActions, useCampusOrgs, type Org } from "../lib/campusOrgs";
import { notice } from "../lib/notice";
import ApplicationDetails from "./ApplicationDetails";
import RichText from "./RichText";

type View = "pending" | "active" | "rejected";
const inView = (o: Org, v: View) => (v === "pending" ? o.status === "pending" : v === "active" ? o.status === "active" || o.status === "paused" : o.status === "rejected");
const ago = (iso?: string) => {
  if (!iso) return "";
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

/** Every club application in one place for coordinators: waiting, approved and declined, updating as students send them and as other coordinators decide. */
export default function ApplicationsBoard() {
  const { orgs } = useCampusOrgs();
  const [view, setView] = useState<View>("pending");
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [, tick] = useState(0);
  const seen = useRef<Set<string> | null>(null);
  const count = (v: View) => orgs.filter((o) => inView(o, v)).length;
  const sorted = orgs.filter((o) => inView(o, view)).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  // Applications that arrive while this is open are highlighted for a moment.
  const fresh = new Set<string>();
  if (seen.current) for (const o of orgs) if (o.status === "pending" && !seen.current.has(o.id)) fresh.add(o.id);
  useEffect(() => { if (!seen.current) seen.current = new Set(orgs.map((o) => o.id)); }, [orgs]);
  useEffect(() => { const t = window.setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(t); }, []);

  const card = (o: Org) => (
    <li key={o.id} className={"app-card" + (fresh.has(o.id) ? " fresh" : "")}>
      <div className="app-card-head">
        <Link to={`/app/campus/clubs/${o.id}`}><strong><RichText text={o.name} /></strong></Link>
        <span className="muted">{o.status === "pending" ? `Sent ${ago(o.createdAt)}` : o.status === "rejected" ? `Declined ${ago(o.decidedAt)}` : o.status === "paused" ? "Paused" : `Approved ${ago(o.decidedAt)}`}</span>
      </div>
      {o.description && <p className="muted"><RichText text={o.description} /></p>}
      <ApplicationDetails org={o} />
      {o.status === "rejected" && o.note && <p className="muted">Reason given: {o.note}</p>}
      {o.status === "pending" && (declining === o.id ? (
        <form className="htools-row" onSubmit={(e) => { e.preventDefault(); void orgActions.decline(o.id, reason); setDeclining(null); setReason(""); }}>
          <input aria-label="Reason (optional)" autoFocus value={reason} maxLength={200} placeholder="Reason, so they can fix it (optional)" onChange={(x) => setReason(x.target.value)} />
          <button className="btn danger">Decline</button><button type="button" className="btn" onClick={() => setDeclining(null)}>Back</button>
        </form>
      ) : (
        <div className="htools-row">
          <button type="button" className="btn primary" onClick={() => { void orgActions.approve(o.id); notice.show({ icon: "calendar", title: `${o.name} approved`, message: "The student who applied has been told. Its officers can post events now.", ms: 4500 }); }}><Check size={15} aria-hidden="true" /> Approve</button>
          <button type="button" className="btn" onClick={() => { setDeclining(o.id); setReason(""); }}>Decline</button>
        </div>
      ))}
    </li>
  );

  return (
    <section className="apps" aria-label="Club applications">
      <div className="apps-head">
        <h3><Inbox size={15} aria-hidden="true" /> Club applications</h3>
        <span className="live-pill" title="This list updates as applications come in"><span className="live-dot" aria-hidden="true" /> Live</span>
      </div>
      <div className="segment" role="tablist" aria-label="Application status">
        {(["pending", "active", "rejected"] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}>{v === "pending" ? "Waiting" : v === "active" ? "Approved" : "Declined"}{count(v) > 0 && <span className="rem-count">{count(v)}</span>}</button>
        ))}
      </div>
      {sorted.length === 0
        ? <p className="review-clear">{view === "pending" ? <><Check size={18} aria-hidden="true" /> No applications waiting.</> : "Nothing here yet."}</p>
        : <ul className="app-list">{sorted.map(card)}</ul>}
    </section>
  );
}
