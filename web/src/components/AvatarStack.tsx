import { useState } from "react";
import { Link } from "react-router-dom";
import { gradientFor } from "../lib/look";

export type StackPerson = { name: string; /** Their profile id, when they have one: the face then opens their profile. */ id?: string };

/** Overlapping round faces with "+N" for the rest. Point at the stack and the faces spread apart; point at a face and it lifts, with its name in a pill above.
 *  A face with a profile id takes you to that person's profile when you click it. People who are online get a small green dot. */
export default function AvatarStack({ names = [], people, max = 4, size = 28, online = [], label, expandable = false }: {
  names?: string[]; people?: StackPerson[]; max?: number; size?: number; online?: string[]; label?: string;
  /** Tapping the +N bubble opens the whole row, and a dash closes it again. */ expandable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const list: StackPerson[] = (people ?? names.map((name) => ({ name }))).filter((p) => p.name);
  const shown = expandable && open ? list : list.slice(0, max);
  const more = list.length - shown.length;
  const on = new Set(online);
  return (
    <span className="avs" style={{ ["--s" as string]: `${size}px` }} role={expandable ? undefined : "img"} aria-label={expandable ? undefined : label ?? `${list.length} ${list.length === 1 ? "person" : "people"}: ${list.map((p) => p.name).join(", ")}`}>
      {shown.map((p, i) => {
        const cls = "avs-face" + (i >= max ? " avs-in" : "");
        const style = { background: gradientFor(p.name), zIndex: shown.length - i };
        const inner = (
          <>
            <b aria-hidden="true">{p.name.trim().slice(0, 1).toUpperCase()}</b>
            {on.has(p.name) && <span className="avs-on" aria-hidden="true" />}
          </>
        );
        return p.id
          ? <Link key={p.name + i} to={`/app/people/${p.id}`} className={cls + " avs-link"} data-name={p.name} style={style} aria-label={`${p.name}, open profile`}>{inner}</Link>
          : <i key={p.name + i} className={cls} data-name={p.name} style={style}>{inner}</i>;
      })}
      {expandable && list.length > max
        ? <button type="button" className="avs-face avs-more avs-btn" data-name={open ? "Show fewer" : list.slice(max).map((p) => p.name).join(", ")} aria-expanded={open} aria-label={open ? "Show fewer people" : `Show all ${list.length} people`} onClick={() => setOpen((v) => !v)}>{open ? "–" : `+${list.length - max}`}</button>
        : more > 0 && <i className="avs-face avs-more" data-name={list.slice(max).map((p) => p.name).join(", ")} aria-hidden="true">+{more}</i>}
    </span>
  );
}
