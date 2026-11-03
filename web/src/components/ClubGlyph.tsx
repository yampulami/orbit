import type { ReactNode } from "react";
import { libraryIcon } from "../lib/clubIcons";

/** What goes inside a club's or group's mark: a drawn icon from the library (the old emoji choices are drawn as their library twin),
 *  any other emoji, or the first letter of its name. */
export default function ClubGlyph({ icon, name, size = "1em" }: { icon?: string; name: string; size?: string | number }): ReactNode {
  const row = icon ? libraryIcon(icon) : undefined;
  if (row) {
    return <svg className="club-glyph" width={size} height={size} viewBox={`0 0 ${row.vb} ${row.vb}`} aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: row.body }} />;
  }
  return <>{icon || name.slice(0, 1).toUpperCase()}</>;
}
