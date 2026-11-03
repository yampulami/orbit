import { CLUB_ICONS, CLUB_ICON_GROUPS, CLUB_ICON_VIEWBOX, type ClubIconRow } from "./clubIcons.generated";

/** The club icon library. A club keeps its icon as one short string:
 *  "" (the club's first letter), "i:XX" for a drawn icon from the library below (Phosphor, and a few Tabler chess pieces, pulled from Iconify by scripts/pull-club-icons.mjs),
 *  or one of the emoji clubs could pick before the library existed. Those emoji are drawn as their library twin, so every club looks the same.
 *  The id is two characters so it fits the database column, which allows 8. */
export { CLUB_ICONS, CLUB_ICON_GROUPS, CLUB_ICON_VIEWBOX };
export type { ClubIconRow };

const byId = new Map(CLUB_ICONS.map((r) => [r.id, r]));
const byName = new Map(CLUB_ICONS.map((r) => [r.name, r]));

/** The old emoji choices and the drawn icon each one is shown as now. */
const LEGACY: Record<string, string> = {
  "🤖": "robot", "♟️": "chess-knight", "♟": "chess-knight", "🎬": "film-slate", "🎨": "palette", "🎵": "music-notes", "⚽": "soccer-ball",
  "📚": "books", "🧪": "test-tube", "🌱": "plant", "🎮": "game-controller", "🍜": "bowl-food", "🚀": "rocket-launch",
};

export const isLibraryIcon = (icon: string) => icon.startsWith("i:") && byId.has(icon.slice(2));
/** The drawn icon for a stored value: a library code, or one of the old emoji. Anything else (another emoji, or nothing) has none. */
export function libraryIcon(icon: string): ClubIconRow | undefined {
  if (icon.startsWith("i:")) return byId.get(icon.slice(2));
  const twin = LEGACY[icon];
  return twin ? byName.get(twin) : undefined;
}
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
