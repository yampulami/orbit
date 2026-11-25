import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import Avatar from "./Avatar";
import PersonLink from "./PersonLink";
import AlumBadge from "./AlumBadge";
import { OPEN_LABEL, type Alum } from "../lib/alumni";
import type { ClubRef } from "../lib/alumniClubs";

/** One graduate. Read top to bottom the way a student scans: who, where they work, what connects you, what they will help with, then the one action.
 *  `preview` draws it for your own listing, where nothing is clickable. */
export default function AlumniCard({ a, clubs = [], action, preview = false }: { a: Alum; clubs?: ClubRef[]; action?: ReactNode; preview?: boolean }) {
  const shared = clubs.filter((c) => c.mine);
  const other = clubs.filter((c) => !c.mine);
  const where = a.company || a.field || "Graduate";
  const role = a.company ? a.jobTitle : a.jobTitle || "";
  const face = <Avatar name={a.name} id={preview ? a.id || undefined : a.id} size={48} />;
  return (
    <article className="alc" data-shared={shared.length > 0 || undefined}>
      <header className="alc-who">
        {preview ? face : <PersonLink id={a.id} className="cf-avlink" decorative>{face}</PersonLink>}
        <div>
          <div className="alc-name"><h3>{preview ? a.name : <PersonLink id={a.id} className="who-link">{a.name}</PersonLink>}</h3>{preview ? null : <AlumBadge id={a.id} />}</div>
          {(preview || (a.field && a.company)) && <p className="alc-class">{[preview ? `Class of ${a.gradYear}` : "", a.field && a.company ? `Studied ${a.field}` : ""].filter(Boolean).join(" · ")}</p>}
        </div>
      </header>

      <div className="alc-work">
        <p className="alc-where">{where}</p>
        {(role || a.industry) && <p>{[role, a.industry].filter(Boolean).join(" · ")}</p>}
      </div>

      {a.about && <p className="alc-about">{a.about}</p>}

      {clubs.length > 0 && (
        <p className="alc-clubs">
          <Users size={14} aria-hidden="true" />
          <span>
            {shared.length > 0 ? "You share " : "In "}
            {(shared.length > 0 ? shared : other).slice(0, 2).map((c, i) => <span key={c.id}>{i > 0 ? " and " : ""}{preview ? <b>{c.name}</b> : <Link to={`/app/campus/clubs/${c.id}`}>{c.name}</Link>}</span>)}
          </span>
        </p>
      )}

      <footer className="alc-foot">
        {a.openTo.length > 0
          ? <p className="alc-open"><span className="sr">Open to </span>{a.openTo.map((o) => <span key={o}>{OPEN_LABEL[o]}</span>)}</p>
          : <p className="alc-open muted">Open to a hello</p>}
        {action}
      </footer>
    </article>
  );
}
