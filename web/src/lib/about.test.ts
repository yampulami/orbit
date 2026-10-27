import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ supabase: null }));

import { BIO_MAX, HOBBY_LEN, HOBBY_MAX, bioLength, cleanBio, cleanHobbies, parseHobbies } from "./about";

describe("bio", () => {
  it("trims it and squeezes long gaps", () => {
    expect(cleanBio("  hi there  \n\n\n\n\nsecond line ")).toBe("hi there\n\nsecond line");
  });
  it("cuts it to the limit, counting an emoji as one character", () => {
    const long = "😀".repeat(BIO_MAX + 50);
    expect(bioLength(cleanBio(long))).toBe(BIO_MAX);
    expect(bioLength("😀")).toBe(1);
  });
  it("leaves an empty bio empty", () => { expect(cleanBio("   ")).toBe(""); });
});

describe("free-time tags", () => {
  it("drops empties and repeats, ignoring capitals", () => {
    expect(cleanHobbies(["Gaming", " gaming ", "", "Hiking"])).toEqual(["Gaming", "Hiking"]);
  });
  it("shortens each tag and keeps at most the allowed number", () => {
    const many = Array.from({ length: 20 }, (_, i) => `tag ${i}`);
    expect(cleanHobbies(many)).toHaveLength(HOBBY_MAX);
    expect(cleanHobbies(["x".repeat(100)])[0]).toHaveLength(HOBBY_LEN);
  });
  it("reads commas and new lines", () => {
    expect(parseHobbies("Gaming, hiking\nbaking")).toEqual(["Gaming", "hiking", "baking"]);
  });
});
