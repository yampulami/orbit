import { useCallback, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { discardImage, tokenFor, uploadImage, type Uploaded } from "../lib/media";

/** Pictures waiting to be sent with a message or post: one by default, or up to `max`. `compose(text)` gives the text to send (each picture goes on its own line at the end),
 *  `clear()` forgets them after sending, `remove(path)` takes one off, and `drop()` forgets all of them and throws the uploads away. */
export function useAttachment(max = 1) {
  const { session } = useAuth();
  const [items, setItems] = useState<Uploaded[]>([]);
  const held = useRef<Uploaded[]>([]); // the same list, readable inside a slow upload without going stale
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const keep = (next: Uploaded[]) => { held.current = next; setItems(next); };

  const pick = useCallback(async (input: File | File[]) => {
    const files = Array.isArray(input) ? input : [input];
    if (files.length === 0) return;
    setError(""); setBusy(true);
    try {
      const who = session?.user.id ?? "guest";
      if (max === 1) {
        // One picture: a new one replaces the old.
        const prev = held.current[0];
        const up = await uploadImage(files[0], who);
        if (prev) void discardImage(prev.path);
        keep([up]);
        return;
      }
      const room = max - held.current.length;
      if (room <= 0) { setError(`You can add up to ${max} photos.`); return; }
      const take = files.slice(0, room);
      if (files.length > room) setError(`You can add up to ${max} photos, so the first ${room} were added.`);
      for (const f of take) {
        try { keep([...held.current, await uploadImage(f, who)]); }
        catch (e) { setError(e instanceof Error ? e.message : "Could not add the picture."); }
      }
    } finally { setBusy(false); }
  }, [max, session]);

  const clear = useCallback(() => { keep([]); setError(""); }, []);
  const drop = useCallback(() => { held.current.forEach((a) => void discardImage(a.path)); keep([]); setError(""); }, []);
  const remove = useCallback((path: string) => { void discardImage(path); keep(held.current.filter((a) => a.path !== path)); setError(""); }, []);
  const compose = useCallback((text: string) => (items.length ? (text.trim() ? `${text.trim()}\n` : "") + items.map((a) => tokenFor(a.path)).join("\n") : text), [items]);
  return { att: items[0] ?? null, items, max, busy, error, pick, clear, drop, remove, compose, has: items.length > 0, full: items.length >= max };
}
export type Attachment = ReturnType<typeof useAttachment>;

/** The "add a photo" button that sits beside the emoji button. With room for several it opens a picker that takes many at once. */
export function AttachButton({ a, label }: { a: Attachment; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const many = a.max > 1;
  const name = label ?? (many ? (a.items.length ? `Add photos (${a.items.length} of ${a.max})` : `Add photos, up to ${a.max}`) : "Add a photo");
  return (
    <span className="attach-btn-wrap">
      <button type="button" className="emoji-btn attach-btn" aria-label={name} title={name} disabled={a.busy || (many && a.full)} onClick={() => input.current?.click()}><ImagePlus size={18} aria-hidden="true" /></button>
      <input ref={input} type="file" accept="image/*" multiple={many} className="sr" tabIndex={-1} aria-label={name}
        onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; if (f.length) void a.pick(many ? f : f[0]); }} />
    </span>
  );
}

/** The pictures waiting to be sent, each with a way to take it off, and any problem adding them. */
export function AttachPreview({ a }: { a: Attachment }) {
  if (a.items.length === 0 && !a.busy && !a.error) return null;
  return (
    <div className="attach-prev">
      {a.items.map((it) => (
        <span className="attach-thumb" key={it.path}>
          <img src={it.preview} alt="A picture you are sending" />
          <button type="button" className="attach-x" aria-label="Remove this picture" onClick={() => (a.max > 1 ? a.remove(it.path) : a.drop())}><X size={14} aria-hidden="true" /></button>
        </span>
      ))}
      {a.busy && <span className="attach-wait muted" role="status">Adding the picture…</span>}
      {a.max > 1 && a.items.length > 0 && !a.busy && <span className="attach-count muted">{a.items.length} of {a.max}</span>}
      {a.error && <span className="error" role="alert">{a.error}</span>}
    </div>
  );
}
