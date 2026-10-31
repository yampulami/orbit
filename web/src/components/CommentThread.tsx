import { useEffect, useRef, useState, type FormEvent } from "react";
import EmojiButton from "./EmojiButton";
import RichText from "./RichText";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { ancestorsOf, directReplies, replyCount, topLevel } from "../lib/commentThread";
import type { Comment } from "../lib/feedData";
import { enter } from "../lib/motion";
import PersonLink from "./PersonLink";
import VerifiedBadge from "./VerifiedBadge";
import { useVerified } from "../lib/verified";
import SafetyMenu from "./SafetyMenu";

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
};
/** A round avatar painted with a gradient taken from the name, so everyone keeps their own colours. */
const paint = (name: string) => {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const a = [12, 32, 150, 185, 212, 345][h % 6];
  return `hsl(${a} 42% 36%)`;
};
const Face = ({ name, size = 40 }: { name: string; size?: number }) => <i className="ct-av" aria-hidden="true" style={{ width: size, height: size, background: paint(name) }} />;

type Props = {
  /** The post these comments are on (so a report can point at it). */
  postId: string;
  comments: Comment[];
  /** Post a comment straight on the post. */
  onComment: (text: string) => Promise<void> | void;
  /** Post a reply to the comment with this id. */
  onReply: (parentId: string, text: string) => Promise<void> | void;
};

/** The comments on a post, one level at a time, like Twitter or Instagram. Comments on the post are listed as cards; each has a reply icon with a
 *  count. Pressing it opens that comment's thread: the comment on top, a box to reply to it, and its replies as cards of their own, each with
 *  their own reply icon, so you can keep going down. Back goes up one level. */
export default function CommentThread({ postId, comments, onComment, onReply }: Props) {
  const isVerified = useVerified();
  const reduce = useReducedMotion();
  const [focusId, setFocusId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const commentInput = useRef<HTMLTextAreaElement>(null);
  const [sending, setSending] = useState(false);

  const focus = focusId ? comments.find((c) => c.id === focusId) : undefined;
  // If the comment you were looking at is deleted, go back to the list.
  useEffect(() => { if (focusId && !focus) setFocusId(null); }, [focusId, focus]);

  const parent = focus?.parent_id ? comments.find((c) => c.id === focus.parent_id) : undefined;
  const above = focus ? ancestorsOf(comments, focus.id) : [];
  const shown = focus ? directReplies(comments, focus.id) : topLevel(comments);

  const open = (id: string) => { setFocusId(id); setText(""); };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try { if (focus) await onReply(focus.id, t); else await onComment(t); setText(""); } finally { setSending(false); }
  }

  /** One comment or reply as a card: who, when, what they said, and the reply icon with how many replies it has. */
  const card = (c: Comment, kind: "item" | "focus" | "context" = "item") => {
    const n = replyCount(comments, c.id);
    return (
      <article key={c.id} className={"cmt-card" + (kind === "focus" ? " focus" : kind === "context" ? " context" : "")}>
        <div className="cmt-head">
          <PersonLink id={c.user_id} className="who-link"><Face name={c.author_name} /></PersonLink>
          <span className="cmt-who"><PersonLink id={c.user_id} className="who-link"><strong>{c.author_name}</strong></PersonLink>{isVerified(c.user_id) && <VerifiedBadge label="Verified campus staff" />}<span className="cmt-dot" aria-hidden="true">•</span><span className="cmt-when">{ago(c.created_at)}</span></span>
          <SafetyMenu userId={c.user_id} name={c.author_name} postId={postId} commentId={c.id} context="comment" />
        </div>
        <p className="cmt-body"><RichText text={c.body} /></p>
        {kind !== "focus" && (
          <div className="cmt-actions">
            <button type="button" className="cmt-reply" aria-label={n === 0 ? `Reply to ${c.author_name}` : `${n} ${n === 1 ? "reply" : "replies"} to ${c.author_name}. Open the thread`} onClick={() => open(c.id)}>
              <ChevronDown size={15} aria-hidden="true" />{n === 0 ? "reply" : n === 1 ? "reply (1)" : `replies (${n})`}
            </button>
          </div>
        )}
      </article>
    );
  };

  // The new view replaces the old one at once (so it can never get stuck waiting on an animation) and eases in.
  const slide = reduce ? { initial: { opacity: 0 }, animate: { opacity: 1 } } : { initial: { opacity: 0, x: 14 }, animate: { opacity: 1, x: 0, transition: enter } };

  const composer = (
    <form className="ct-compose" onSubmit={submit}>
      <Face name="You" />
      <div className="ct-box">
        <textarea ref={commentInput} rows={2} aria-label={focus ? `Reply to ${focus.author_name}` : "Write a comment"} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit(e as unknown as FormEvent); } }} placeholder={focus ? `Reply to ${focus.author_name}…` : "Enter your comment"} />
        <EmojiButton value={text} onChange={setText} inputRef={commentInput} max={500} />
      </div>
      <button className="ct-post" data-ready={text.trim() && !sending ? "" : undefined} disabled={!text.trim() || sending}>{sending ? "Posting…" : focus ? "Post reply" : "Post comment"}</button>
    </form>
  );

  return (
    <motion.div key={focusId ?? "list"} className="cmt-view" {...slide}>
        {focus ? (
          <>
            <button type="button" className="cmt-back" onClick={() => setFocusId(parent?.id ?? null)}>
              <ArrowLeft size={16} aria-hidden="true" />{parent ? `Back to ${parent.author_name}'s comment` : "All comments"}
            </button>
            {above.map((a) => card(a, "context"))}
            {card(focus, "focus")}
            {composer}
            {shown.length === 0
              ? <p className="cmt-empty">No replies yet. Start the thread.</p>
              : <section className="cmt-list" aria-label={`Replies to ${focus.author_name}`}>{shown.map((c) => card(c))}</section>}
          </>
        ) : (
          <>
            <h4 className="ct-title">Comments{comments.length > 0 && <span>{comments.length}</span>}</h4>
            {composer}
            {shown.length > 0 && <section className="cmt-list" aria-label="Comments">{shown.map((c) => card(c))}</section>}
          </>
        )}
    </motion.div>
  );
}
