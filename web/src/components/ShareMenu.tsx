import { useEffect, useState } from "react";
import { Check, Link2, Mail, MessageSquare, Share2, X } from "lucide-react";
import { dmActions } from "../lib/dms";
import { friendsLive, useFriends } from "../lib/friends";
import { notice } from "../lib/notice";

type Props = {
  /** What is being shared: the words, who wrote them, and a link back to it. */
  text: string; author: string; url: string;
  onClose: () => void;
};

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

/** Pure: where each place takes the shared words and link. */
export function shareTargets(text: string, author: string, url: string) {
  const line = `${clip(text, 200)} (${author} on Orbit)`;
  const q = encodeURIComponent;
  return {
    email: `mailto:?subject=${q(`${author} on Orbit`)}&body=${q(`${line}\n\n${url}`)}`,
    x: `https://twitter.com/intent/tweet?text=${q(line)}&url=${q(url)}`,
    whatsapp: `https://wa.me/?text=${q(`${line} ${url}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${q(url)}`,
    telegram: `https://t.me/share/url?url=${q(url)}&text=${q(line)}`,
    reddit: `https://www.reddit.com/submit?url=${q(url)}&title=${q(line)}`,
  };
}

/** Share a post: send it to a friend in a message, email it, copy the link, or open it in another app. */
export default function ShareMenu({ text, author, url, onClose }: Props) {
  const { friends } = useFriends();
  const [picking, setPicking] = useState(false);
  const [sent, setSent] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const t = shareTargets(text, author, url);
  const canNative = typeof navigator !== "undefined" && "share" in navigator;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { notice.show({ icon: "alert", title: "Could not copy", message: "Select the link and copy it by hand." }); }
  }
  async function toFriend(id: string, name: string) {
    const thread = await dmActions.start(id);
    if (!thread) { notice.show({ icon: "alert", title: "Could not open that chat", message: "Try again in a moment." }); return; }
    dmActions.send(thread, `${clip(text, 300)}\n${url}`);
    setSent((l) => [...l, id]);
    notice.show({ icon: "pin", title: `Sent to ${name}`, message: "It is in your messages.", ms: 2500 });
  }

  const open = (href: string) => window.open(href, "_blank", "noopener,noreferrer");

  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal share" role="dialog" aria-modal="true" aria-label="Share this post">
        <header className="share-head">
          <h2>Share</h2>
          <button type="button" className="ac-icon" aria-label="Close" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </header>
        <blockquote className="share-quote"><strong>{author}</strong><span>{clip(text, 140)}</span></blockquote>

        <div className="share-grid">
          {friendsLive && <button type="button" className="share-opt" aria-expanded={picking} onClick={() => setPicking((v) => !v)}><span className="share-ic" style={{ background: "var(--accent)" }}><MessageSquare size={20} aria-hidden="true" /></span>Message</button>}
          <button type="button" className="share-opt" onClick={() => open(t.email)}><span className="share-ic" style={{ background: "#e0793a" }}><Mail size={20} aria-hidden="true" /></span>Email</button>
          <button type="button" className="share-opt" onClick={() => void copy()}><span className="share-ic" style={{ background: "#1fa97a" }}>{copied ? <Check size={20} aria-hidden="true" /> : <Link2 size={20} aria-hidden="true" />}</span>{copied ? "Copied" : "Copy link"}</button>
          <button type="button" className="share-opt" onClick={() => open(t.whatsapp)}><span className="share-ic" style={{ background: "#25b05a" }}>W</span>WhatsApp</button>
          <button type="button" className="share-opt" onClick={() => open(t.x)}><span className="share-ic" style={{ background: "#14120f" }}>X</span>X</button>
          <button type="button" className="share-opt" onClick={() => open(t.facebook)}><span className="share-ic" style={{ background: "#2f6fe0" }}>f</span>Facebook</button>
          <button type="button" className="share-opt" onClick={() => open(t.telegram)}><span className="share-ic" style={{ background: "#2a9fd8" }}>T</span>Telegram</button>
          <button type="button" className="share-opt" onClick={() => open(t.reddit)}><span className="share-ic" style={{ background: "#e8532a" }}>r</span>Reddit</button>
          {canNative && <button type="button" className="share-opt" onClick={() => { void navigator.share({ text: `${clip(text, 200)} (${author} on Orbit)`, url }).catch(() => undefined); }}><span className="share-ic" style={{ background: "var(--ink-soft)" }}><Share2 size={20} aria-hidden="true" /></span>More</button>}
        </div>

        {picking && friendsLive && (
          <div className="share-friends">
            <h3>Send to a friend</h3>
            {friends.length === 0 ? <p className="muted">Add friends first, and you can send them posts here.</p> : (
              <ul>
                {friends.map((f) => (
                  <li key={f.id}>
                    <span className="gs-ico gs-av" aria-hidden="true">{f.name.slice(0, 1).toUpperCase()}</span>
                    <span className="grow"><strong>{f.name}</strong>{f.username && <span className="muted"> @{f.username}</span>}</span>
                    <button type="button" className="btn sm" disabled={sent.includes(f.id)} onClick={() => void toFriend(f.id, f.name)}>{sent.includes(f.id) ? "Sent" : "Send"}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <label className="share-link"><span className="sr">Link to this post</span><input readOnly value={url} onFocus={(e) => e.currentTarget.select()} /></label>
      </div>
    </div>
  );
}
