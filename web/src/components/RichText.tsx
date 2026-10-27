import { useState, type ReactNode } from "react";
import { emojiUrls, hasEmoji, splitEmoji } from "../lib/emojiImages";

/** One emoji as a picture. If a picture cannot be loaded (offline, or one this set does not have), it tries the other file names, then the device's own emoji. */
export function Emoji({ e }: { e: string }) {
  const urls = emojiUrls(e);
  const [n, setN] = useState(0);
  if (n >= urls.length) return <span className="emoji-native">{e}</span>;
  return <img className="emoji-img" src={urls[n]} alt={e} draggable={false} decoding="async" onError={() => setN((i) => i + 1)} />;
}

/** Text with its emoji drawn as pictures, so they look the same on every device. Use it wherever people's words are shown. */
export default function RichText({ text }: { text: string }): ReactNode {
  if (!text || !hasEmoji(text)) return <>{text}</>;
  return <>{splitEmoji(text).map((p, i) => ("text" in p ? <span key={i}>{p.text}</span> : <Emoji key={i} e={p.emoji} />))}</>;
}
