import { useState } from "react";
import { X } from "lucide-react";
import RichText from "./RichText";

export type CommentRow = { id: string; author: string; body: string; at: string; mine: boolean };

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
/** A round avatar painted with a gradient from the person's name, so everyone keeps their own colours. */
const paint = (name: string) => {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const a = [12, 32, 150, 185, 212, 345][h % 6];
  return `hsl(${a} 42% 46%)`;
};
export const Avatar = ({ name, size = 40 }: { name: string; size?: number }) => <i className="ct-av" aria-hidden="true" style={{ width: size, height: size, background: paint(name) }} />;

/** A post's comments: a heading with the count, a box to write in, and each comment as its own bordered row. */
export default function ClubComments({ id, comments, canWrite, canModerate, me, onPost, onRemove }: {
  id: string; comments: CommentRow[]; canWrite: boolean; canModerate: boolean; me: string;
  onPost: (body: string) => Promise<string | null | void>; onRemove: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = text.trim().length > 0 && !busy;

  async function post(e?: React.FormEvent) {
    e?.preventDefault();
    if (!ready) return;
    setBusy(true);
    const err = await onPost(text);
    setBusy(false);
    if (!err) setText("");
  }

  return (
    <section className="ct" aria-label="Comments">
      <h4 className="ct-title">Comments{comments.length > 0 && <span>{comments.length}</span>}</h4>
      {canWrite && (
        <form className="ct-compose" onSubmit={post}>
          <Avatar name={me} />
          <div className="ct-box">
            <label className="sr" htmlFor={`ct-${id}`}>Write a comment</label>
            <textarea id={`ct-${id}`} rows={2} value={text} maxLength={500} placeholder="Enter your comment" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void post(); }} />
          </div>
          <button className="ct-post" data-ready={ready ? "" : undefined} disabled={!ready}>{busy ? "Posting…" : "Post comment"}</button>
        </form>
      )}
      {comments.length === 0 ? (
        <p className="ct-none">{canWrite ? "No comments yet. Start the conversation." : "No comments yet."}</p>
      ) : (
        <ul className="ct-list">
          {comments.map((c) => (
            <li key={c.id} className="ct-item">
              <Avatar name={c.author} />
              <div className="ct-main">
                <p className="ct-meta"><strong>{c.author}</strong><span aria-hidden="true">•</span><time>{ago(c.at)}</time></p>
                <p className="ct-body"><RichText text={c.body} /></p>
              </div>
              {(c.mine || canModerate) && <button type="button" className="ct-del" aria-label="Delete comment" onClick={() => onRemove(c.id)}><X size={14} aria-hidden="true" /></button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
