import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useMediaUrl } from "../lib/media";

/** A picture someone sent. Small in the conversation; press it to see it large, and Escape (or pressing anywhere) closes it. */
export default function MediaImage({ path }: { path: string }) {
  const url = useMediaUrl(path);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);
  if (url === null) return <span className="media-img media-wait skeleton" aria-busy="true" aria-label="Loading picture" />;
  if (url === "") return <span className="media-img media-gone">This picture is no longer available.</span>;
  return (
    <>
      <button type="button" className="media-img" onClick={() => setOpen(true)} aria-label="Open picture"><img src={url} alt="A picture that was sent" loading="lazy" decoding="async" draggable={false} /></button>
      {open && (
        <div className="media-view" role="dialog" aria-modal="true" aria-label="Picture" onClick={() => setOpen(false)}>
          <button type="button" className="media-close" aria-label="Close picture" onClick={() => setOpen(false)} autoFocus><X size={20} aria-hidden="true" /></button>
          <img src={url} alt="A picture that was sent" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
