import { describe, expect, it } from "vitest";
import { CLUB_ICONS, CLUB_ICON_GROUPS, cleanClubIcon, iconCode, isLibraryIcon, libraryIcon, searchIcons, suggestIcons } from "./clubIcons";

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

describe("suggested icons", () => {
  const labels = (name: string, category = "") => suggestIcons(name, category).map((r) => r.label.toLowerCase());
  it("puts icons that go with the name first", () => {
    expect(labels("Photography Club")[0]).toBe("camera");
    expect(labels("Chess Club")).toContain("chess");
    expect(labels("Robotics Club")).toContain("robot");
    expect(labels("Martial Arts Club")).toEqual(expect.arrayContaining(["boxing glove"]));
  });
  it("fills the rest from the category's group, without repeats, up to the limit", () => {
    const out = suggestIcons("Photography Club", "Arts and culture", 8);
    expect(out.length).toBe(8);
    expect(new Set(out.map((r) => r.id)).size).toBe(8);
    expect(out.slice(2).every((r) => r.group === "Arts and culture")).toBe(true);
  });
  it("still offers something for an unknown name with a category, and nothing with neither", () => {
    expect(suggestIcons("Zzzz", "Academic").length).toBeGreaterThan(0);
    expect(suggestIcons("Zzzz", "")).toEqual([]);
  });
});

describe("colour names", () => {
  it("names every club colour, so a swatch is not read out as a number", async () => {
    const { CLUB_HUES, hueName } = await import("./clubIcons");
    for (const h of CLUB_HUES) expect(hueName(h)).not.toBe("Colour");
    expect(new Set(CLUB_HUES.map(hueName)).size).toBe(CLUB_HUES.length);
  });
});
