import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Ban, Flag, MoreHorizontal } from "lucide-react";
import { useAuth } from "../lib/auth";
import { notice } from "../lib/notice";
import { REASONS, safetyActions, safetyLive, type Reason } from "../lib/safety";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = {
  userId: string;
  name: string;
  /** What is being reported, if it is a post or a comment (otherwise it is the person). */
  postId?: string;
  commentId?: string;
  /** Where it is happening, for the person reading the report: "post", "comment", "direct message", "profile". */
  context?: string;
  /** Called after the person has been blocked, for example to leave their profile. */
  onBlocked?: () => void;
};

/** A "..." menu with Report and Block, for another student's post, comment, message or profile. It does not show for your own things,
 *  or without a database (there are no other real students in demo mode). */
export default function SafetyMenu({ userId, name, postId, commentId, context = "profile", onBlocked }: Props) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<"none" | "report" | "block">("none");
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (!safetyLive || !UUID.test(userId) || userId === session?.user.id) return null;
  const what = commentId ? "comment" : postId ? "post" : "person";

  return (
    <span className="safety-wrap" ref={root}>
      <button type="button" className="safety-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`More options for ${name}`} onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {open && (
        <ul className="safety-menu" role="menu">
          <li role="none"><button type="button" role="menuitem" onClick={() => { setOpen(false); setDialog("report"); }}><Flag size={15} aria-hidden="true" />Report this {what}</button></li>
          <li role="none"><button type="button" role="menuitem" onClick={() => { setOpen(false); setDialog("block"); }}><Ban size={15} aria-hidden="true" />Block {name}</button></li>
        </ul>
      )}
      {dialog === "report" && createPortal(<ReportDialog userId={userId} name={name} postId={postId} commentId={commentId} context={context} what={what} onClose={() => setDialog("none")} />, document.body)}
      {dialog === "block" && createPortal(<BlockDialog userId={userId} name={name} onClose={() => setDialog("none")} onDone={() => { setDialog("none"); onBlocked?.(); }} />, document.body)}
    </span>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
}

function ReportDialog({ userId, name, postId, commentId, context, what, onClose }: { userId: string; name: string; postId?: string; commentId?: string; context: string; what: string; onClose: () => void }) {
  const [reason, setReason] = useState<Reason | null>(null);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEscape(onClose);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!reason) { setError("Pick what is wrong."); return; }
    setBusy(true); setError("");
    const problem = await safetyActions.report({ userId, postId, commentId, reason, detail, context });
    setBusy(false);
    if (problem) { setError(problem); return; }
    notice.show({ icon: "pin", title: "Report sent", message: "Thank you. Someone will look at it. You can also block them if you do not want to see them.", ms: 5000 });
    onClose();
  }

  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal safety-dialog" role="dialog" aria-modal="true" aria-labelledby="report-title" onSubmit={send}>
        <h2 id="report-title">Report this {what}</h2>
        <p className="muted">About {name}. Reports are private: they do not see that you sent one.</p>
        <fieldset className="safety-reasons">
          <legend className="sr">What is wrong</legend>
          {REASONS.map((r) => (
            <label key={r.id} className={"safety-reason" + (reason === r.id ? " on" : "")}>
              <input type="radio" name="reason" value={r.id} checked={reason === r.id} onChange={() => { setReason(r.id); setError(""); }} />{r.label}
            </label>
          ))}
        </fieldset>
        <label className="field">Anything we should know? (optional)
          <textarea maxLength={500} rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="safety-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? "Sending…" : "Send report"}</button>
        </div>
      </form>
    </div>
  );
}

function BlockDialog({ userId, name, onClose, onDone }: { userId: string; name: string; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEscape(onClose);

  async function block() {
    setBusy(true); setError("");
    const problem = await safetyActions.block(userId, name);
    setBusy(false);
    if (problem) { setError(problem); return; }
    notice.show({ icon: "pin", title: `${name} is blocked`, message: "You can unblock them any time in Profile.", ms: 5000 });
    onDone();
  }

  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal safety-dialog" role="alertdialog" aria-modal="true" aria-labelledby="block-title" aria-describedby="block-text">
        <h2 id="block-title">Block {name}?</h2>
        <p id="block-text" className="muted">You will not see their posts, comments, messages or plans, and they will not see yours. They cannot message you or add you as a friend, and if you are friends now, that ends. They are not told.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="safety-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy} autoFocus>Cancel</button>
          <button type="button" className="btn danger" onClick={() => void block()} disabled={busy}>{busy ? "Blocking…" : `Block ${name}`}</button>
        </div>
      </div>
    </div>
  );
}
