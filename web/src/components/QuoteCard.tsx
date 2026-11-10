import { Link } from "react-router-dom";
import { X } from "lucide-react";
import Avatar from "./Avatar";
import PersonName from "./PersonName";
import RichText from "./RichText";
import { ago } from "../lib/dayWords";
import type { Row } from "../lib/feedData";

/** A post shown inside another one, like a quote on X. `row` is undefined while it loads and null when it is gone (deleted, or not something you can see).
 *  With `onRemove` it is the preview in the post box, with a way to take the quote off. */
export default function QuoteCard({ row, onRemove }: { row: Row | null | undefined; onRemove?: () => void }) {
  return (
    <div className={"qcard" + (onRemove ? " qcard-edit" : "")}>
      {row === undefined ? <div className="skeleton sk-line" aria-busy="true" aria-label="Loading the quoted post" />
        : row === null ? <p className="qcard-gone muted">This post is no longer available.</p>
        : (
          <>
            <Link className="qcard-head" to={`/app/feed?post=${row.id}`} aria-label={`Quoted post by ${row.author_name}, open it`}>
              <Avatar name={row.author_name} id={row.author_id} size={22} />
              <strong><PersonName id={row.author_id} fallback={row.author_name} /></strong>
              <span>{ago(row.created_at)}</span>
            </Link>
            <p className="qcard-body"><RichText text={row.payload.body ?? row.payload.text ?? ""} /></p>
          </>
        )}
      {onRemove && <button type="button" className="qcard-x" aria-label="Remove the quoted post" onClick={onRemove}><X size={14} aria-hidden="true" /></button>}
    </div>
  );
}
