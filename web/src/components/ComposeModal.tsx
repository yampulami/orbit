import { useEffect, useRef, useState, type FormEvent } from "react";
import EmojiButton from "./EmojiButton";
import { useDisplayName } from "../lib/displayName";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2, X } from "lucide-react";
import CommunityPicker from "./CommunityPicker";
import { useAuth } from "../lib/auth";
import { draftActions, useDrafts } from "../lib/drafts";
import { feedApi, type Campus } from "../lib/feedData";
import { progress } from "../lib/progress";
import { undo } from "../lib/undo";
import { enter, exit } from "../lib/motion";
import type { Community } from "../shared/feed";

const MAX = 1000;
const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : new Date(iso).toLocaleDateString();
};

/** The new-post window opened by the round button in the sidebar. Works from any page. */
export default function ComposeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session } = useAuth();
  const nav = useNavigate();
  const me = session?.user.id ?? "";
  const name = useDisplayName();
  const drafts = useDrafts();
  const [text, setText] = useState("");
  const [community, setCommunity] = useState<Community>("Everyone");
  const [campus, setCampus] = useState<Campus | null | undefined>(undefined); // undefined = still checking
  const [view, setView] = useState<"write" | "drafts">("write");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const card = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    setCampus(undefined); setError("");
    feedApi.campus().then(setCampus).catch(() => setCampus(null));
    const lock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = lock; (opener.current as HTMLElement | null)?.focus?.(); };
  }, [open]);

  function close(keepDraft = true) {
    const body = text.trim();
    if (keepDraft && body) {
      const id = draftActions.save(body, community);
      undo.show("Saved to drafts", { onUndo: () => draftActions.remove(id), commit: () => {} });
    }
    setText(""); setView("write"); setError("");
    onClose();
  }

  // Escape closes; Tab stays inside the window.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab" || !card.current) return;
      const f = [...card.current.querySelectorAll<HTMLElement>("button:not([disabled]), textarea, input, [href], [tabindex]:not([tabindex='-1'])")].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function post(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !campus || busy) return;
    setBusy(true); setError("");
    try {
      const id = crypto.randomUUID();
      await feedApi.publish({ id, campus_key: campus.key, author_id: me, author_name: name, community, body });
      progress.log("post");
      window.dispatchEvent(new Event("orbit-posts-changed"));
      undo.show(`Posted to ${community}`, {
        onUndo: () => { feedApi.remove(id).catch(() => {}).finally(() => window.dispatchEvent(new Event("orbit-posts-changed"))); },
        commit: () => {},
      });
      setText(""); setView("write");
      onClose();
    } catch (err) {
      setError((err as Error).message || "Couldn’t post. Try again.");
    } finally { setBusy(false); }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-back" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: enter }} exit={{ opacity: 0, transition: exit }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <motion.div ref={card} className="modal" role="dialog" aria-modal="true" aria-label="New post" initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1, transition: enter }} exit={{ opacity: 0, y: 10, transition: exit }} onAnimationComplete={() => area.current?.focus()}>
            <div className="modal-top">
              <button type="button" className="round-btn" aria-label="Close" onClick={() => close()}><X size={20} aria-hidden="true" /></button>
              <button type="button" className="link-btn" onClick={() => setView((v) => (v === "drafts" ? "write" : "drafts"))}>{view === "drafts" ? "Back to post" : `Drafts${drafts.length ? ` (${drafts.length})` : ""}`}</button>
            </div>

            {view === "drafts" ? (
              <div className="draft-list">
                {drafts.length === 0 ? <p className="rm-empty">No drafts yet. Close a post you haven’t sent and it is saved here.</p> : (
                  <ul>
                    {drafts.map((d) => (
                      <li key={d.id}>
                        <button type="button" className="draft-main" onClick={() => { setText(d.text); setCommunity(d.community); draftActions.remove(d.id); setView("write"); }}>
                          <strong>{d.text.length > 90 ? `${d.text.slice(0, 89)}…` : d.text}</strong>
                          <span>{d.community} · {ago(d.at)}</span>
                        </button>
                        <button type="button" className="ghost-btn" aria-label="Delete draft" onClick={() => draftActions.remove(d.id)}><Trash2 size={16} aria-hidden="true" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : campus === null ? (
              <div className="compose-join">
                <p>Your posts go to your campus, so join one first.</p>
                <button type="button" className="btn primary" onClick={() => { close(false); nav("/app/feed"); }}>Join your campus</button>
              </div>
            ) : (
              <form onSubmit={post}>
                <div className="compose-body">
                  <span className="me" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
                  <textarea ref={area} id="compose-text" value={text} maxLength={MAX} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} placeholder="What’s happening on campus?" aria-label="What’s happening on campus?" />
                </div>
                {error && <p className="error" role="alert">{error}</p>}
                <div className="compose-foot">
                  <div className="compose-to"><span id="compose-to">Post to</span><CommunityPicker value={community} onChange={setCommunity} labelledBy="compose-to" id="compose-community" /></div>
                  <EmojiButton value={text} onChange={setText} inputRef={area} max={MAX} />
                  <span className={"count" + (text.length > MAX * 0.9 ? " warn" : "")} aria-live="polite">{text.length}/{MAX}</span>
                  <button className="btn primary" disabled={busy || !text.trim() || campus === undefined}>{busy ? "Posting…" : "Post"}</button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
