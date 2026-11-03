import type { ReactNode } from "react";
import { CLUB_ICON_VIEWBOX, libraryIcon } from "../lib/clubIcons";

/** What goes inside a club's round or square mark: a drawn icon from the library, an emoji, or the club's first letter. */
export default function ClubGlyph({ icon, name, size = "1em" }: { icon?: string; name: string; size?: string | number }): ReactNode {
  const row = icon ? libraryIcon(icon) : undefined;
  if (row) {
    return <svg className="club-glyph" width={size} height={size} viewBox={`0 0 ${CLUB_ICON_VIEWBOX} ${CLUB_ICON_VIEWBOX}`} aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: row.body }} />;
  }
  return <>{icon || name.slice(0, 1).toUpperCase()}</>;
}
