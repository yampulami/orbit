import { CLUB_ICONS, CLUB_ICON_GROUPS, CLUB_ICON_VIEWBOX, type ClubIconRow } from "./clubIcons.generated";

/** The club icon library. A club keeps its icon as one short string:
 *  "" (the club's first letter), an emoji, or "i:XX" for a drawn icon from the library below (Phosphor, pulled from Iconify by scripts/pull-club-icons.mjs).
 *  The id is two characters so it fits the database column, which allows 8. */
export { CLUB_ICONS, CLUB_ICON_GROUPS, CLUB_ICON_VIEWBOX };
export type { ClubIconRow };

const byId = new Map(CLUB_ICONS.map((r) => [r.id, r]));
export const isLibraryIcon = (icon: string) => icon.startsWith("i:") && byId.has(icon.slice(2));
export const libraryIcon = (icon: string): ClubIconRow | undefined => (icon.startsWith("i:") ? byId.get(icon.slice(2)) : undefined);
export const iconCode = (row: ClubIconRow) => `i:${row.id}`;
export const iconsIn = (group: string) => CLUB_ICONS.filter((r) => r.group === group);

/** The most a club's icon can be once saved: a library code, or one or two emoji. */
export function cleanClubIcon(icon: string): string {
  const t = icon.trim();
  if (t.startsWith("i:")) return isLibraryIcon(t) ? t : "";
  return Array.from(t).slice(0, 2).join("");
}

/** Library icons matching a search, by name or group. */
export function searchIcons(q: string): ClubIconRow[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  return CLUB_ICONS.filter((r) => r.label.toLowerCase().includes(needle) || r.group.toLowerCase().includes(needle));
}
