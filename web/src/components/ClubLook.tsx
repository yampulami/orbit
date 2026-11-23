import ClubGlyph from "./ClubGlyph";
import IconChooser from "./IconChooser";
import { CLUB_HUES } from "../lib/clubIcons";

/** "Make it yours" for a new club: what it will look like (the tile and name, in the colour chosen), a colour, and an icon (ones that suit the name first).
 *  Choosing something tells Omega on the step bar to glance down at it. */
export default function ClubLook({ name, category, icon, accent, onIcon, onAccent }: {
  name: string; category: string; icon: string; accent: number | null; onIcon: (icon: string) => void; onAccent: (hue: number | null) => void;
}) {
  const glance = () => window.dispatchEvent(new Event("cv:picked"));
  return (
    <div className="club-look">
      <div className="look-preview" style={{ ["--h" as string]: accent ?? 18 }} aria-label="How it will look">
        <span className="look-tile" aria-hidden="true"><ClubGlyph icon={icon} name={name.trim() || "A"} /></span>
        <span className="look-pname"><strong>{name.trim() || "Your club"}</strong><em>{category || "Student club"}</em></span>
      </div>
      <div>
        <p className="look-h">Colour</p>
        <div className="look-colours" role="radiogroup" aria-label="Colour">
          {CLUB_HUES.map((h) => (
            <button key={h} type="button" role="radio" aria-checked={accent === h} aria-label={`Colour ${h}`} className="look-sw" style={{ ["--h" as string]: h }}
              onClick={() => { onAccent(accent === h ? null : h); glance(); }} />
          ))}
        </div>
      </div>
      <IconChooser value={icon} name={name} category={category} onChange={(v) => { onIcon(v); glance(); }} />
    </div>
  );
}
