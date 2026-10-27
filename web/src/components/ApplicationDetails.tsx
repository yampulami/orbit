import type { Org } from "../lib/campusOrgs";
import RichText from "./RichText";

/** The answers on a club application, as the coordinator reads them. */
export default function ApplicationDetails({ org }: { org: Org }) {
  const a = org.application;
  const rows: [string, string][] = [
    ["What it is for", a.purpose], ["Category", a.category], ["Adviser", a.advisorName ? `${a.advisorName}${a.advisorEmail ? ` · ${a.advisorEmail}` : ""}` : ""],
    ["Meets", a.meeting], ["Expected size", a.expectedMembers ? `${a.expectedMembers} people` : ""], ["First event", a.firstEvent], ["Contact", a.contact], ["Applied by", org.creator],
  ];
  const shown = rows.filter(([, v]) => v);
  if (shown.length === 0) return null;
  return (
    <dl className="app-details">
      {shown.map(([k, v]) => <div key={k}><dt>{k}</dt><dd><RichText text={v} /></dd></div>)}
    </dl>
  );
}
