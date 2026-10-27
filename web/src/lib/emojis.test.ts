import { describe, expect, it } from "vitest";
import { ALL_EMOJI, EMOJI_GROUPS, insertAt, searchEmoji } from "./emojis";

describe("emoji", () => {
  it("has groups full of emoji with no repeats within a group", () => {
    expect(EMOJI_GROUPS.length).toBeGreaterThanOrEqual(7);
    expect(ALL_EMOJI.length).toBeGreaterThan(300);
    for (const g of EMOJI_GROUPS) expect(new Set(g.items.map((x) => x.e)).size).toBe(g.items.length);
  });
  it("finds emoji by what they are called", () => {
    expect(searchEmoji("pizza").map((x) => x.e)).toContain("🍕");
    expect(searchEmoji("coffee").map((x) => x.e)).toContain("☕");
    expect(searchEmoji("heart love").map((x) => x.e)).toContain("❤️");
    expect(searchEmoji("zzzzzz")).toEqual([]);
    expect(searchEmoji("   ")).toEqual([]);
  });
  it("puts an emoji at the caret", () => {
    expect(insertAt("hello world", "🎉", 5, 5)).toEqual({ text: "hello🎉 world", caret: 7 });
  });
  it("replaces a selection", () => {
    expect(insertAt("hello world", "🌍", 6, 11)).toEqual({ text: "hello 🌍", caret: 8 });
  });
  it("stays under a limit counted in characters people see, not code units", () => {
    expect(insertAt("a".repeat(239), "😀", 239, 239, 240)).not.toBeNull(); // 240 characters
    expect(insertAt("a".repeat(240), "😀", 240, 240, 240)).toBeNull();
  });
  it("copes with a caret outside the text", () => {
    expect(insertAt("hi", "👋", 99, 99)).toEqual({ text: "hi👋", caret: 4 });
  });
});
