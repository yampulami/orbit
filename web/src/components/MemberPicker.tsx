import { useMemo, useState, type FormEvent } from "react";
import { Check, Plus } from "lucide-react";
import { useFriends } from "../lib/friends";
import { useHang, YOU } from "../lib/hangouts";
import { useSpace } from "../lib/roommates";
import { useCampusOrgs } from "../lib/campusOrgs";
import { buildPeopleSets, everyone, type PeopleSet, type Pick, type SetKey } from "../lib/peopleSets";

const paint = (name: string) => {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const a = [12, 32, 150, 185, 212, 345][h % 6];
  return `hsl(${a} 42% 46%)`;
};
const initial = (n: string) => n.trim().slice(0, 1).toUpperCase() || "?";

/** Friends, dorm mates, circles and hangout groups, ready to pick from. */
export function usePeopleSets(exclude: string[] = []): PeopleSet[] {
  const { friends } = useFriends();
  const { groups } = useHang();
  const space = useSpace();
  const { orgs } = useCampusOrgs();
  const key = exclude.join("|");
  return useMemo(() => buildPeopleSets({
    friends: friends.map((f) => ({ id: f.id, name: f.name })),
    dorm: space?.members ?? [],
    circles: orgs.filter((o) => o.kind === "circle" && (o.mine || o.myJoin === "member")).map((o) => ({ name: o.name, people: [...o.members.map((m) => m.name), ...o.clubMembers.map((m) => m.name)] })),
    groups: groups.map((g) => ({ name: g.name, members: g.members })),
    exclude: [YOU, "You", ...exclude],
  }), [friends, groups, space, orgs, key]); // eslint-disable-line react-hooks/exhaustive-deps
}

type Props = {
  label?: string;
  /** Who can be picked. Defaults to everyone in the sets. */
  people: Pick[];
  sets?: PeopleSet[];
  isOn: (p: Pick) => boolean;
  /** Choose or un-choose someone. Left out, people are shown but cannot be changed (they are already in). */
  onToggle: (p: Pick) => void;
  /** People already in, who cannot be taken out here. */
  locked?: (p: Pick) => boolean;
  /** The dashed Add circle: type a name (or username) to bring in someone who is not listed. Resolves to a message when it did not work. */
  onAddNew?: (text: string) => Promise<string | null | void> | string | null | void;
  addPlaceholder?: string;
};

/** A row of round faces with names. People who are in are in colour with their name bold; people you could add are dimmed with a small plus. Tap to switch. */
export default function MemberPicker({ label = "Participants", people, sets = [], isOn, onToggle, locked, onAddNew, addPlaceholder = "Name or @username" }: Props) {
  const [filter, setFilter] = useState<SetKey | "all">("all");
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const shown = filter === "all" ? people : people.filter((p) => sets.find((s) => s.key === filter)?.people.some((x) => x.name === p.name));
  const ons = shown.filter(isOn).length;

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!onAddNew || !text.trim()) return;
    const problem = await onAddNew(text.trim());
    if (problem) { setError(problem); return; }
    setText(""); setError(""); setAdding(false);
  }

  return (
    <section className="mp" aria-label={label}>
      <header className="mp-head">
        <h3>{label}{ons > 0 && <span>{ons}</span>}</h3>
        {sets.length > 1 && (
          <div className="mp-sets" role="tablist" aria-label="Where to look">
            <button type="button" role="tab" aria-selected={filter === "all"} onClick={() => setFilter("all")}>Everyone</button>
            {sets.map((s) => <button key={s.key} type="button" role="tab" aria-selected={filter === s.key} onClick={() => setFilter(s.key)}>{s.label}</button>)}
          </div>
        )}
      </header>
      <ul className="mp-row">
        {shown.map((p) => {
          const on = isOn(p), fixed = !!locked?.(p);
          return (
            <li key={p.id}>
              <button type="button" className="mp-person" aria-pressed={on} disabled={fixed} data-on={on ? "" : undefined} title={fixed ? `${p.name} is in already` : on ? `Take ${p.name} out` : `Add ${p.name}`} onClick={() => onToggle(p)}>
                <span className="mp-face" style={{ background: paint(p.name) }}>
                  <b aria-hidden="true">{initial(p.name)}</b>
                  {!on && <i className="mp-plus" aria-hidden="true"><Plus size={12} strokeWidth={3} /></i>}
                  {on && !fixed && <i className="mp-tick" aria-hidden="true"><Check size={11} strokeWidth={3.4} /></i>}
                </span>
                <span className="mp-name">{p.name}</span>
              </button>
            </li>
          );
        })}
        {onAddNew && (
          <li>
            <button type="button" className="mp-person mp-add" aria-expanded={adding} onClick={() => { setAdding((v) => !v); setError(""); }}>
              <span className="mp-face"><Plus size={22} aria-hidden="true" /></span>
              <span className="mp-name">Add</span>
            </button>
          </li>
        )}
      </ul>
      {shown.length === 0 && !onAddNew && <p className="muted mp-none">Nobody here yet.</p>}
      {adding && onAddNew && (
        <form className="mp-form" onSubmit={add}>
          <label className="sr" htmlFor="mp-new">Add someone</label>
          <input id="mp-new" autoFocus value={text} maxLength={30} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={addPlaceholder} onChange={(e) => { setText(e.target.value); setError(""); }} />
          <button className="btn sm primary" disabled={!text.trim()}>Add</button>
          {error && <p className="error" role="alert">{error}</p>}
        </form>
      )}
    </section>
  );
}

export { everyone };
