import { useCallback, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { discardImage, tokenFor, uploadImage, type Uploaded } from "../lib/media";

/** One picture waiting to be sent with a message or post. `compose(text)` gives the text to send (the picture goes on its own line at the end),
 *  `clear()` forgets it after sending, and `drop()` forgets it and throws the upload away. */
export function useAttachment() {
  const { session } = useAuth();
  const [att, setAtt] = useState<Uploaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pick = useCallback(async (file: File) => {
    setError(""); setBusy(true);
    try {
      const prev = att;
      const up = await uploadImage(file, session?.user.id ?? "guest");
      if (prev) void discardImage(prev.path);
      setAtt(up);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add the picture."); }
    finally { setBusy(false); }
  }, [att, session]);
  const clear = useCallback(() => { setAtt(null); setError(""); }, []);
  const drop = useCallback(() => { if (att) void discardImage(att.path); setAtt(null); setError(""); }, [att]);
  const compose = useCallback((text: string) => (att ? (text.trim() ? `${text.trim()}\n` : "") + tokenFor(att.path) : text), [att]);
  return { att, busy, error, pick, clear, drop, compose, has: !!att };
}
export type Attachment = ReturnType<typeof useAttachment>;

/** The "add a photo" button that sits beside the emoji button. */
export function AttachButton({ a, label = "Add a photo" }: { a: Attachment; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <span className="attach-btn-wrap">
      <button type="button" className="emoji-btn attach-btn" aria-label={label} title={label} disabled={a.busy} onClick={() => input.current?.click()}><ImagePlus size={18} aria-hidden="true" /></button>
      <input ref={input} type="file" accept="image/*" className="sr" tabIndex={-1} aria-label={label}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void a.pick(f); }} />
    </span>
  );
}

/** The picture waiting to be sent, with a way to take it off, and any problem adding it. */
export function AttachPreview({ a }: { a: Attachment }) {
  if (!a.att && !a.busy && !a.error) return null;
  return (
    <div className="attach-prev">
      {a.busy && <span className="attach-wait muted" role="status">Adding the picture…</span>}
      {a.att && !a.busy && (
        <span className="attach-thumb">
          <img src={a.att.preview} alt="The picture you are sending" />
          <button type="button" className="attach-x" aria-label="Remove the picture" onClick={a.drop}><X size={14} aria-hidden="true" /></button>
        </span>
      )}
      {a.error && <span className="error" role="alert">{a.error}</span>}
    </div>
  );
}
