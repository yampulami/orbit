import { motion } from "framer-motion";
import { Heart, MessageCircle, Repeat2, Send, type LucideIcon } from "lucide-react";
import RollingNumber from "./RollingNumber";

type Props = {
  liked: boolean; likes: number; onLike: () => void;
  commentsOpen: boolean; comments: number; onComment: () => void;
  reposted: boolean; reposts: number; onRepost?: () => void;
  onShare: () => void;
  /** What the post is about, so each button has a name of its own ("Comments on …") for screen readers. */
  subject?: string;
};

/** One pill with the four things you can do to a post: like, comment, repost, share. Each icon pops when you switch it on and each count rolls to its new number. */
function Item({ Icon, active, count, label, tone, onClick, disabled }: { Icon: LucideIcon; active: boolean; count?: number; label: string; tone: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="rb-item" data-on={active ? "" : undefined} style={{ ["--tone" as string]: tone }} aria-pressed={count === undefined ? undefined : active} aria-label={label} disabled={disabled} onClick={onClick}>
      <motion.span key={active ? "on" : "off"} className="rb-ic" initial={active ? { scale: 0.6, rotate: -12 } : false} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 520, damping: 14 }}>
        <Icon size={20} strokeWidth={1.9} fill={active && Icon === Heart ? "currentColor" : "none"} aria-hidden="true" />
      </motion.span>
      {count !== undefined && <RollingNumber value={count} />}
    </button>
  );
}

export default function ReactionBar({ liked, likes, onLike, commentsOpen, comments, onComment, reposted, reposts, onRepost, onShare, subject }: Props) {
  const of = subject ? ` on “${subject}”` : "";
  return (
    <div className="rb" role="group" aria-label="Reactions">
      <Item Icon={Heart} active={liked} count={likes} label={(liked ? "Unlike" : "Like") + of} tone="#f0476b" onClick={onLike} />
      <Item Icon={MessageCircle} active={commentsOpen} count={comments} label={"Comments" + of} tone="var(--violet)" onClick={onComment} />
      <Item Icon={Repeat2} active={reposted} count={reposts} label={(reposted ? "Undo repost" : "Repost") + of} tone="#1fa97a" onClick={onRepost} disabled={!onRepost} />
      <Item Icon={Send} active={false} label={"Share" + of} tone="var(--violet)" onClick={onShare} />
    </div>
  );
}
