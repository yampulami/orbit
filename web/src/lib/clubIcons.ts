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

/** The colours a club can have, as hues (0 to 360). They tint its icon, header and highlights. */
export const CLUB_HUES = [12, 28, 45, 95, 150, 185, 210, 340];

/** Which group of icons goes with each club category. */
const CATEGORY_GROUP: Record<string, string> = {
  "Academic": "Academic", "Arts and culture": "Arts and culture", "Sports and fitness": "Sports and fitness", "Service and volunteering": "Service and community",
  "Faith and belief": "Faith and belief", "Career and professional": "Career and business", "Gaming and hobbies": "Games and hobbies", "Other": "Social",
};
const FILLER = new Set(["club", "the", "and", "for", "society", "association", "team", "group", "circle", "students", "student", "university", "college", "campus", "our", "of"]);
/** Words people put in club names, and the icons (by label) that go with them. */
const IDEAS: [RegExp, string[]][] = [
  [/^photo/, ["camera", "image"]], [/^(film|movie|cinema)/, ["film slate", "film strip", "video camera"]], [/^video/, ["video camera"]],
  [/^(art|paint|draw|sketch|illustrat)/, ["palette", "paint brush", "pencil simple"]], [/^design/, ["palette", "pen nib"]], [/^craft|^knit|^sew|^fashion|^thrift/, ["scissors", "tote"]],
  [/^(music|jazz|orchestra)/, ["music notes", "headphones", "piano keys"]], [/^(band|guitar)/, ["guitar", "music notes"]], [/^piano/, ["piano keys"]],
  [/^(sing|choir|vocal|acapella|karaoke)/, ["microphone", "music notes"]], [/^(danc|ballet|salsa|hiphop)/, ["disco ball", "music notes"]],
  [/^(theat|drama|improv|act)/, ["mask happy", "microphone stage"]], [/^(writ|poet|journal|news|zine)/, ["pen nib", "newspaper", "book open"]], [/^(book|read|liter)/, ["books", "book open text"]],
  [/^(code|coding|program|software|hack|comput|cs$|web|app)/, ["code", "terminal window", "cpu"]], [/^(robot)/, ["robot", "cpu", "wrench"]], [/^(engineer|mech|maker|build)/, ["wrench", "hammer", "circuitry"]],
  [/^(math|stat|calcul|actuar)/, ["calculator", "chart bar"]], [/^(scien|chem)/, ["flask", "test tube", "atom"]], [/^(bio|medic|premed|nurs|health)/, ["dna", "microscope", "stethoscope"]],
  [/^(physic|astro|space|aero)/, ["atom", "planet", "rocket launch"]], [/^(psych|mind|mental|wellness)/, ["brain", "heart"]],
  [/^(env|sustain|green|garden|plant|eco)/, ["plant", "leaf", "recycle", "tree"]],
  [/^(business|entrepren|financ|invest|market|consult|econ)/, ["briefcase", "chart line up", "coins", "storefront"]], [/^(law|debate|politic|mock|model)/, ["gavel", "scales", "megaphone"]],
  [/^(volunt|service|charit|help|communit)/, ["hand heart", "handshake", "heart"]], [/^(faith|prayer|christ|bible|church|catholic)/, ["church", "hands praying", "cross"]],
  [/^(muslim|islam)/, ["mosque", "star and crescent"]], [/^(jew|hillel)/, ["star of david"]], [/^(hindu|buddh|meditat|yoga|mindful)/, ["yin yang", "flower lotus", "person simple tai chi"]],
  [/^(sport|athlet|fitness|gym|lift|crossfit)/, ["barbell", "trophy", "medal"]], [/^soccer/, ["soccer ball"]], [/^basket/, ["basketball"]], [/^(football)/, ["football"]], [/^(base|softball)/, ["baseball"]],
  [/^(tennis|badminton|pickle)/, ["tennis ball"]], [/^volley/, ["volleyball"]], [/^(run|track|marathon)/, ["person simple run", "sneaker"]], [/^(bike|cycl)/, ["bicycle"]], [/^(swim|diving|polo)/, ["swimming pool"]],
  [/^(box|martial|karate|judo|mma|taekwondo|kung|jiu)/, ["boxing glove", "person simple tai chi"]], [/^golf/, ["golf"]], [/^hockey/, ["hockey"]],
  [/^(hik|climb|outdoor|camp|trail)/, ["mountains", "tent", "campfire"]], [/^(sail|row|boat|kayak|canoe)/, ["sailboat", "boat"]], [/^chess/, ["chess", "chess knight"]],
  [/^(game|gaming|esport|board|tabletop|dnd|dungeon|poker|card)/, ["game controller", "dice five", "puzzle piece", "cards"]], [/^(anime|manga|cosplay)/, ["sparkle", "sword"]],
  [/^(cook|bak|food|culinar|foodie)/, ["cooking pot", "bread", "bowl food", "cake"]], [/^(coffee|tea)/, ["coffee"]], [/^(pet|animal|dog|cat)/, ["paw print", "dog", "cat"]],
  [/^(travel|abroad)/, ["airplane tilt", "globe"]], [/^(language|cultur|intern|spanish|french|chinese)/, ["translate", "globe", "chats circle"]], [/^(social|party|mixer|friend)/, ["confetti", "balloon", "smiley"]],
];

/** Icons worth showing first for a club: ones that go with words in its name, then the group that goes with its category. */
export function suggestIcons(name: string, category: string, max = 8): ClubIconRow[] {
  const out: ClubIconRow[] = [], seen = new Set<string>();
  const add = (r: ClubIconRow | undefined) => { if (r && !seen.has(r.id) && out.length < max) { seen.add(r.id); out.push(r); } };
  const byLabel = (l: string) => CLUB_ICONS.find((r) => r.label.toLowerCase() === l);
  for (const w of name.toLowerCase().split(/[^a-z]+/).filter((x) => x.length >= 2 && !FILLER.has(x))) {
    for (const [re, labels] of IDEAS) if (re.test(w)) labels.forEach((l) => add(byLabel(l)));
    if (w.length >= 4) CLUB_ICONS.filter((r) => r.label.toLowerCase().includes(w)).slice(0, 3).forEach(add);
  }
  const g = CATEGORY_GROUP[category];
  if (g) iconsIn(g).forEach(add);
  return out;
}

/** What to call each club colour out loud (a screen reader, a tooltip). */
const HUE_NAMES: Record<number, string> = { 12: "Red", 28: "Orange", 45: "Gold", 95: "Green", 150: "Mint", 185: "Teal", 210: "Blue", 340: "Pink" };
export const hueName = (h: number) => HUE_NAMES[h] ?? "Colour";
