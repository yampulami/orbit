import { useState, type ReactNode } from "react";
import { emojiUrls, hasEmoji, splitEmoji } from "../lib/emojiImages";
import { chunk, groupPieces, hasMedia, splitMedia } from "../lib/media";
import MediaImage from "./MediaImage";

/** One emoji as a picture. If a picture cannot be loaded (offline, or one this set does not have), it tries the other file names, then the device's own emoji. */
export function Emoji({ e }: { e: string }) {
  const urls = emojiUrls(e);
  const [n, setN] = useState(0);
  if (n >= urls.length) return <span className="emoji-native">{e}</span>;
  return <img className="emoji-img" src={urls[n]} alt={e} draggable={false} decoding="async" onError={() => setN((i) => i + 1)} />;
}

/** Text with its emoji drawn as pictures, so they look the same on every device. Use it wherever people's words are shown. */
export default function RichText({ text }: { text: string }): ReactNode {
  // A picture is written into the text on its own line; show it as a picture and the rest as words.
  // Pictures that sit together (up to four) show as one grid; a single picture stays large.
  if (text && hasMedia(text)) return <>{groupPieces(splitMedia(text)).map((g, i) => ("imgs" in g
    ? chunk(g.imgs).map((c, k) => (c.length === 1 ? <MediaImage key={`${i}-${k}`} path={c[0]} /> : <div key={`${i}-${k}`} className="media-grid" data-n={c.length}>{c.map((path) => <MediaImage key={path} path={path} group={c} />)}</div>))
    : <RichText key={i} text={g.text} />))}</>;
  if (!text || !hasEmoji(text)) return <>{text}</>;
  return <>{splitEmoji(text).map((p, i) => ("text" in p ? <span key={i}>{p.text}</span> : <Emoji key={i} e={p.emoji} />))}</>;
}
