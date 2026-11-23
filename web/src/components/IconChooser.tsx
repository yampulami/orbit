import { useState } from "react";
import { Search } from "lucide-react";
import ClubGlyph from "./ClubGlyph";
import { CLUB_ICON_GROUPS, iconCode, iconsIn, libraryIcon, searchIcons, suggestIcons } from "../lib/clubIcons";

/** Pick an icon: a search, one tab per group of drawn icons, and the name's first letter as the plain choice.
 *  Used for a club's look, in the forms that start a club, and for a group chat. `onChange("")` means "first letter". */
export default function IconChooser({ value, name, onChange, category }: { value: string; name: string; onChange: (icon: string) => void; /** With this (or a name), icons that suit the club are shown first. */ category?: string }) {
  const current = value ? libraryIcon(value) : undefined;
  const [group, setGroup] = useState<string>(current?.group ?? CLUB_ICON_GROUPS[0]);
  const [q, setQ] = useState("");
  const searching = q.trim().length > 0;
  const list = searching ? searchIcons(q) : iconsIn(group);
  const suggested = suggestIcons(name, category ?? "", 8);
  const tile = (r: (typeof list)[number]) => (
    <button key={r.id} type="button" role="radio" aria-checked={current?.id === r.id} className="look-ic" aria-label={r.label} title={r.label} onClick={() => onChange(iconCode(r))}>
      <ClubGlyph icon={iconCode(r)} name="" />
    </button>
  );
  return (
    <div className="icon-chooser">
      {suggested.length > 0 && !searching && (
        <section aria-label="Suggested icons">
          <p className="look-h">Suggested for {name.trim() ? `“${name.trim().slice(0, 28)}”` : "your club"}</p>
          <div className="look-row" role="radiogroup" aria-label="Suggested icons">
            <button type="button" role="radio" aria-checked={!value} className="look-ic" aria-label="First letter" onClick={() => onChange("")}>{(name.trim().slice(0, 1) || "A").toUpperCase()}</button>
            {suggested.map(tile)}
          </div>
        </section>
      )}
      <label className="look-search"><Search size={16} aria-hidden="true" /><input value={q} maxLength={30} placeholder="Search icons, like chess or music" aria-label="Search icons" onChange={(e) => setQ(e.target.value)} /></label>
      {searching ? (
        <div className="look-row look-grid" role="radiogroup" aria-label="Search results">
          {list.map(tile)}
          {list.length === 0 && <p className="muted look-none">No icon matches that. Try a broader word.</p>}
        </div>
      ) : (
        // with suggestions above, the whole library folds away until it is wanted
        <details className="look-all" open={suggested.length === 0 || undefined}>
          <summary>Browse all icons</summary>
          <div className="look-groups" role="tablist" aria-label="Icon groups">
            {CLUB_ICON_GROUPS.map((g) => <button key={g} type="button" role="tab" aria-selected={group === g} onClick={() => setGroup(g)}>{g}</button>)}
          </div>
          <div className="look-row look-grid" role="radiogroup" aria-label="Icon">
            {suggested.length === 0 && <button type="button" role="radio" aria-checked={!value} className="look-ic" aria-label="First letter" onClick={() => onChange("")}>{(name.trim().slice(0, 1) || "A").toUpperCase()}</button>}
            {list.map(tile)}
          </div>
        </details>
      )}
    </div>
  );
}
