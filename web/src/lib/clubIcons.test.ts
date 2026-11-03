import { describe, expect, it } from "vitest";
import { CLUB_ICONS, CLUB_ICON_GROUPS, cleanClubIcon, iconCode, isLibraryIcon, libraryIcon, searchIcons } from "./clubIcons";

describe("club icon library", () => {
  it("has icons in every group, each with a short unique id that fits the database column", () => {
    for (const g of CLUB_ICON_GROUPS) expect(CLUB_ICONS.some((r) => r.group === g)).toBe(true);
    expect(new Set(CLUB_ICONS.map((r) => r.id)).size).toBe(CLUB_ICONS.length);
    for (const r of CLUB_ICONS) { expect(iconCode(r).length).toBeLessThanOrEqual(8); expect(r.body).toContain("<path"); }
  });
  it("keeps a library code whole, still trims emoji, and drops an unknown code", () => {
    const code = iconCode(CLUB_ICONS[0]);
    expect(cleanClubIcon(code)).toBe(code);
    expect(isLibraryIcon(code)).toBe(true);
    expect(libraryIcon(code)?.id).toBe(CLUB_ICONS[0].id);
    expect(cleanClubIcon("🤖🎬🎵")).toBe("🤖🎬");
    expect(cleanClubIcon("i:zz")).toBe("");
  });
  it("draws the old emoji choices as library icons, and leaves other emoji alone", () => {
    for (const e of ["🤖", "♟️", "🎬", "🎨", "🎵", "⚽", "📚", "🧪", "🌱", "🎮", "🍜", "🚀"]) expect(libraryIcon(e)).toBeDefined();
    expect(libraryIcon("🦄")).toBeUndefined();
    expect(libraryIcon("")).toBeUndefined();
  });
  it("finds icons by name or group", () => {
    expect(searchIcons("chess").length + searchIcons("games").length).toBeGreaterThan(0);
    expect(searchIcons("")).toEqual([]);
  });
});
