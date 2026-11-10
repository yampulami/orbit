import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Smile } from "lucide-react";
import { EMOJI_GROUPS, insertAt, recentEmoji, rememberEmoji, searchEmoji } from "../lib/emojis";
import { haptic } from "../lib/haptics";
import { Emoji } from "./RichText";
import { useIsPhone } from "../lib/phone";

/** A smiley button that opens an emoji picker and puts the chosen emoji where the caret is in `inputRef`'s box. They are the device's own emoji. */
export default function EmojiButton({ value, onChange, inputRef, max, label = "Add an emoji" }: {
  value: string;
  onChange: (v: string) => void;
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  /** Longest the text may be, in characters people see. */
  max?: number;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState(EMOJI_GROUPS[0].id);
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const root = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const phone = useIsPhone(); // on a phone the picker is a sheet at the bottom of the screen, placed by the stylesheet
  const [spot, setSpot] = useState<CSSProperties | undefined>(undefined);
  const caret = useRef({ start: 0, end: 0 });
  const id = useId();

  /** Where the picker goes: next to its button, on the side with more room, never off the screen. It is drawn on top of the page (see the portal below), so
   *  nothing can cut it off, and only the emoji list scrolls inside it. */
  const place = useCallback(() => {
    const b = btn.current?.getBoundingClientRect();
    if (!b) return;
    const gap = 8, edge = 8, vw = window.innerWidth, vh = window.innerHeight;
    const width = Math.min(332, vw - edge * 2);
    const above = b.top - gap - edge, below = vh - b.bottom - gap - edge;
    const up = above >= 360 || above >= below;
    const room = Math.max(220, Math.min(420, up ? above : below));
    const left = Math.min(Math.max(edge, b.right - width), vw - width - edge);
    setSpot({ left, width, maxHeight: room, ...(up ? { bottom: vh - b.top + gap } : { top: b.bottom + gap }) });
  }, []);
  useLayoutEffect(() => { if (open && !phone) place(); }, [open, phone, place]);
  useEffect(() => {
    if (!open || phone) return;
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, phone, place]);

  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { const t = e.target as Node; if (!root.current?.contains(t) && !pop.current?.contains(t)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); inputRef.current?.focus(); } };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open, inputRef]);

  function toggle() {
    if (!open) {
      const el = inputRef.current;
      caret.current = { start: el?.selectionStart ?? value.length, end: el?.selectionEnd ?? value.length };
      setRecent(recentEmoji()); setQ("");
    }
    setOpen((v) => !v);
  }

  function pick(e: string) {
    const r = insertAt(value, e, caret.current.start, caret.current.end, max);
    if (!r) { haptic("warn"); return; }
    haptic("select");
    rememberEmoji(e);
    onChange(r.text);
    caret.current = { start: r.caret, end: r.caret };
    // The text box keeps the caret after the emoji, so several can be added in a row.
    requestAnimationFrame(() => { const el = inputRef.current; if (el) { el.focus(); el.setSelectionRange(r.caret, r.caret); } });
  }

  const found = q.trim() ? searchEmoji(q) : null;
  const shown = found ?? EMOJI_GROUPS.find((g) => g.id === group)!.items;

  return (
    <span className="emoji-wrap" ref={root}>
      <button ref={btn} type="button" className="emoji-btn" aria-label={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={toggle}><Smile size={18} aria-hidden="true" /></button>
      {open && createPortal(
        <div className="emoji-pop" id={id} ref={pop} role="dialog" aria-label="Emoji" style={phone ? undefined : spot}>
          <input className="emoji-search" type="search" aria-label="Search emoji" placeholder="Search emoji" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          {!found && (
            <div className="emoji-tabs" role="tablist" aria-label="Emoji categories">
              {EMOJI_GROUPS.map((g) => <button key={g.id} type="button" role="tab" aria-selected={g.id === group} aria-label={g.label} title={g.label} onClick={() => setGroup(g.id)}><Emoji e={g.icon} /></button>)}
            </div>
          )}
          <div className="emoji-grid" role="listbox" aria-label={found ? "Search results" : EMOJI_GROUPS.find((g) => g.id === group)!.label}>
            {!found && recent.length > 0 && group === EMOJI_GROUPS[0].id && (
              <>
                <p className="emoji-h">Recent</p>
                {recent.map((e) => <button key={"r" + e} type="button" role="option" aria-selected={false} onClick={() => pick(e)}><Emoji e={e} /></button>)}
                <p className="emoji-h">{EMOJI_GROUPS[0].label}</p>
              </>
            )}
            {shown.length === 0 && <p className="emoji-none">Nothing matches that.</p>}
            {shown.map((x) => <button key={x.e} type="button" role="option" aria-selected={false} aria-label={x.k.split(" ")[0] || x.e} title={x.k} onClick={() => pick(x.e)}><Emoji e={x.e} /></button>)}
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}
