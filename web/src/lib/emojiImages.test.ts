import { describe, expect, it } from "vitest";
import { emojiUrls, hasEmoji, splitEmoji } from "./emojiImages";

const joinBack = (text: string) => splitEmoji(text).map((p) => ("text" in p ? p.text : p.emoji)).join("");

describe("splitting text into emoji", () => {
  it("finds emoji between words and gives the text back unchanged", () => {
    const t = "coffee ☕ and 😀 time";
    expect(splitEmoji(t)).toEqual([{ text: "coffee " }, { emoji: "☕" }, { text: " and " }, { emoji: "😀" }, { text: " time" }]);
    expect(joinBack(t)).toBe(t);
  });
  it("keeps skin tones and joined emoji as one", () => {
    expect(splitEmoji("👍🏽")).toEqual([{ emoji: "👍🏽" }]);
    expect(splitEmoji("👨‍💻")).toEqual([{ emoji: "👨‍💻" }]);
    expect(splitEmoji("🧑‍🎓")).toEqual([{ emoji: "🧑‍🎓" }]);
  });
  it("keeps flags and keycaps as one", () => {
    expect(splitEmoji("🇺🇸")).toEqual([{ emoji: "🇺🇸" }]);
    expect(splitEmoji("1️⃣")).toEqual([{ emoji: "1️⃣" }]);
  });
  it("handles hearts and other emoji that need the style mark", () => {
    expect(splitEmoji("❤️")).toEqual([{ emoji: "❤️" }]);
    expect(splitEmoji("✌️ peace")).toEqual([{ emoji: "✌️" }, { text: " peace" }]);
  });
  it("leaves ordinary text, numbers and symbols alone", () => {
    expect(splitEmoji("Room 101 #3 (c) ™ © 2026")).toEqual([{ text: "Room 101 #3 (c) ™ © 2026" }]);
    expect(hasEmoji("plain")).toBe(false);
    expect(hasEmoji("hi 🎉")).toBe(true);
  });
  it("finds the first emoji even right after checking for any", () => {
    expect(hasEmoji("a ☕ b")).toBe(true);
    expect(splitEmoji("a ☕ b")).toEqual([{ text: "a " }, { emoji: "☕" }, { text: " b" }]);
  });
  it("copes with an empty string and with new lines", () => {
    expect(splitEmoji("")).toEqual([]);
    expect(joinBack("a\n🍕\nb")).toBe("a\n🍕\nb");
  });
  it("pads short code points the way the picture files are named", () => {
    expect(emojiUrls("1️⃣")[0]).toMatch(/\/0031-fe0f-20e3\.png$/);
  });
  it("builds picture addresses to try", () => {
    const urls = emojiUrls("😀");
    expect(urls[0]).toMatch(/\/1f600\.png$/);
    expect(emojiUrls("❤️")[0]).toMatch(/\/2764-fe0f\.png$/);
    expect(emojiUrls("❤️")[1]).toMatch(/\/2764\.png$/);
    expect(emojiUrls("😀").every((u) => u.startsWith("https://cdn.jsdelivr.net/npm/emoji-datasource-apple"))).toBe(true);
  });
});
