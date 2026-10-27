import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Smile } from "lucide-react";
import { EMOJI_GROUPS, insertAt, recentEmoji, rememberEmoji, searchEmoji } from "../lib/emojis";
import { haptic } from "../lib/haptics";

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
  const caret = useRef({ start: 0, end: 0 });
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
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
      <button type="button" className="emoji-btn" aria-label={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={toggle}><Smile size={18} aria-hidden="true" /></button>
      {open && (
        <div className="emoji-pop" id={id} role="dialog" aria-label="Emoji">
          <input className="emoji-search" type="search" aria-label="Search emoji" placeholder="Search emoji" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          {!found && (
            <div className="emoji-tabs" role="tablist" aria-label="Emoji categories">
              {EMOJI_GROUPS.map((g) => <button key={g.id} type="button" role="tab" aria-selected={g.id === group} aria-label={g.label} title={g.label} onClick={() => setGroup(g.id)}>{g.icon}</button>)}
            </div>
          )}
          <div className="emoji-grid" role="listbox" aria-label={found ? "Search results" : EMOJI_GROUPS.find((g) => g.id === group)!.label}>
            {!found && recent.length > 0 && group === EMOJI_GROUPS[0].id && (
              <>
                <p className="emoji-h">Recent</p>
                {recent.map((e) => <button key={"r" + e} type="button" role="option" aria-selected={false} onClick={() => pick(e)}>{e}</button>)}
                <p className="emoji-h">{EMOJI_GROUPS[0].label}</p>
              </>
            )}
            {shown.length === 0 && <p className="emoji-none">Nothing matches that.</p>}
            {shown.map((x) => <button key={x.e} type="button" role="option" aria-selected={false} aria-label={x.k.split(" ")[0] || x.e} title={x.k} onClick={() => pick(x.e)}>{x.e}</button>)}
          </div>
        </div>
      )}
    </span>
  );
}
