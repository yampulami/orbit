import { gradientFor } from "../lib/look";

/** Overlapping round faces with "+N" for the rest. Point at the stack and the faces spread apart; point at a face and it lifts, with its name in a pill above.
 *  People who are online get a small green dot. */
export default function AvatarStack({ names, max = 4, size = 28, online = [], label }: { names: string[]; max?: number; size?: number; online?: string[]; label?: string }) {
  const list = names.filter(Boolean);
  const shown = list.slice(0, max);
  const more = list.length - shown.length;
  const on = new Set(online);
  return (
    <span className="avs" style={{ ["--s" as string]: `${size}px` }} role="img" aria-label={label ?? `${list.length} ${list.length === 1 ? "person" : "people"}: ${list.join(", ")}`}>
      {shown.map((n, i) => (
        <i key={n + i} className="avs-face" data-name={n} style={{ background: gradientFor(n), zIndex: shown.length - i }}>
          <b aria-hidden="true">{n.trim().slice(0, 1).toUpperCase()}</b>
          {on.has(n) && <span className="avs-on" aria-hidden="true" />}
        </i>
      ))}
      {more > 0 && <i className="avs-face avs-more" data-name={list.slice(max).join(", ")} aria-hidden="true">+{more}</i>}
    </span>
  );
}
