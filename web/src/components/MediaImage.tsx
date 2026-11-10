import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { mediaUrl, useMediaUrl } from "../lib/media";

/** A picture someone sent. Small in the conversation; press it to see it large. Pictures that were posted together open as one gallery:
 *  arrows (on screen, on the keyboard, or a swipe) move between them. Escape or pressing the dark area closes it. */
export default function MediaImage({ path, group }: { path: string; group?: string[] }) {
  const url = useMediaUrl(path);
  const [open, setOpen] = useState(false);
  if (url === null) return <span className="media-img media-wait skeleton" aria-busy="true" aria-label="Loading picture" />;
  if (url === "") return <span className="media-img media-gone">This picture is no longer available.</span>;
  const all = group && group.length > 1 ? group : [path];
  return (
    <>
      <button type="button" className="media-img" onClick={() => setOpen(true)} aria-label="Open picture"><img src={url} alt="A picture that was sent" loading="lazy" decoding="async" draggable={false} /></button>
      {open && <Viewer paths={all} start={Math.max(0, all.indexOf(path))} onClose={() => setOpen(false)} />}
    </>
  );
}

/** The large view. It is drawn on the page itself, not inside the post, so a post or column that clips or transforms its contents cannot shrink or hide it. */
function Viewer({ paths, start, onClose }: { paths: string[]; start: number; onClose: () => void }) {
  const [at, setAt] = useState(start);
  const url = useMediaUrl(paths[at]);
  const many = paths.length > 1;
  const go = (d: number) => setAt((i) => (i + d + paths.length) % paths.length);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (many && e.key === "ArrowRight") go(1);
      else if (many && e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [many, onClose]);
  // Fetch the neighbours ahead of time so moving on is instant.
  useEffect(() => { if (many) { void mediaUrl(paths[(at + 1) % paths.length]); void mediaUrl(paths[(at - 1 + paths.length) % paths.length]); } }, [at, many, paths]);
  // A swipe on a phone.
  const [downX, setDownX] = useState<number | null>(null);
  return createPortal(
    <div className="media-view" role="dialog" aria-modal="true" aria-label={many ? `Picture ${at + 1} of ${paths.length}` : "Picture"} onClick={onClose}>
      <button type="button" className="media-close" aria-label="Close picture" onClick={(e) => { e.stopPropagation(); onClose(); }} autoFocus><X size={20} aria-hidden="true" /></button>
      {many && <button type="button" className="media-nav prev" aria-label="Previous picture" onClick={(e) => { e.stopPropagation(); go(-1); }}><ChevronLeft size={24} aria-hidden="true" /></button>}
      {url ? (
        <img src={url} alt={many ? `Picture ${at + 1} of ${paths.length}` : "A picture that was sent"} draggable={false} onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => setDownX(e.clientX)}
          onPointerUp={(e) => { if (many && downX !== null && Math.abs(e.clientX - downX) > 50) go(e.clientX < downX ? 1 : -1); setDownX(null); }} />
      ) : <span className="media-wait skeleton media-view-wait" aria-busy="true" />}
      {many && <button type="button" className="media-nav next" aria-label="Next picture" onClick={(e) => { e.stopPropagation(); go(1); }}><ChevronRight size={24} aria-hidden="true" /></button>}
      {many && <p className="media-count" aria-hidden="true">{at + 1} / {paths.length}</p>}
    </div>,
    document.body,
  );
}
