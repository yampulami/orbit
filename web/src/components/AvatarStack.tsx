import { gradientFor } from "../lib/look";

/** Overlapping round faces with "+N" for the rest. Point at the stack and the faces spread out so each one can be seen; each has its name on hover. */
export default function AvatarStack({ names, max = 4, size = 28, label }: { names: string[]; max?: number; size?: number; label?: string }) {
  const list = names.filter(Boolean);
  const shown = list.slice(0, max);
  const more = list.length - shown.length;
  return (
    <span className="avs" style={{ ["--s" as string]: `${size}px` }} role="img" aria-label={label ?? `${list.length} ${list.length === 1 ? "person" : "people"}: ${list.join(", ")}`}>
      {shown.map((n, i) => (
        <i key={n + i} className="avs-face" title={n} style={{ background: gradientFor(n), zIndex: shown.length - i }}><b aria-hidden="true">{n.trim().slice(0, 1).toUpperCase()}</b></i>
      ))}
      {more > 0 && <i className="avs-face avs-more" title={list.slice(max).join(", ")} aria-hidden="true">+{more}</i>}
    </span>
  );
}
