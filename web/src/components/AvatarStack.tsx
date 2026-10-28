import { useState } from "react";
import { gradientFor } from "../lib/look";

/** Overlapping round faces with "+N" for the rest. Point at the stack and the faces spread apart; point at a face and it lifts, with its name in a pill above.
 *  People who are online get a small green dot. */
export default function AvatarStack({ names, max = 4, size = 28, online = [], label, expandable = false }: { names: string[]; max?: number; size?: number; online?: string[]; label?: string; /** Tapping the +N bubble opens the whole row, and a dash closes it again. */ expandable?: boolean }) {
  const [open, setOpen] = useState(false);
  const list = names.filter(Boolean);
  const shown = expandable && open ? list : list.slice(0, max);
  const more = list.length - shown.length;
  const on = new Set(online);
  return (
    <span className="avs" style={{ ["--s" as string]: `${size}px` }} role={expandable ? undefined : "img"} aria-label={expandable ? undefined : label ?? `${list.length} ${list.length === 1 ? "person" : "people"}: ${list.join(", ")}`}>
      {shown.map((n, i) => (
        <i key={n + i} className={"avs-face" + (i >= max ? " avs-in" : "")} data-name={n} style={{ background: gradientFor(n), zIndex: shown.length - i }}>
          <b aria-hidden="true">{n.trim().slice(0, 1).toUpperCase()}</b>
          {on.has(n) && <span className="avs-on" aria-hidden="true" />}
        </i>
      ))}
      {expandable && list.length > max
        ? <button type="button" className="avs-face avs-more avs-btn" data-name={open ? "Show fewer" : list.slice(max).join(", ")} aria-expanded={open} aria-label={open ? "Show fewer people" : `Show all ${list.length} people`} onClick={() => setOpen((v) => !v)}>{open ? "–" : `+${list.length - max}`}</button>
        : more > 0 && <i className="avs-face avs-more" data-name={list.slice(max).join(", ")} aria-hidden="true">+{more}</i>}
    </span>
  );
}
