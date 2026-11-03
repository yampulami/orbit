import { describe, expect, it } from "vitest";
import { hasMedia, previewOf, splitMedia, tokenFor } from "./media";
import { OPTIONS, critterUri, fromSpec, presets, toSpec } from "./avatars";

describe("picture tokens", () => {
  it("splits words and pictures in order", () => {
    const text = `look at this\n${tokenFor("u1/a.jpg")}`;
    expect(hasMedia(text)).toBe(true);
    expect(splitMedia(text)).toEqual([{ text: "look at this" }, { img: "u1/a.jpg" }]);
  });
  it("shows a picture on its own as Photo, and words with a note", () => {
    expect(previewOf(tokenFor("u1/a.jpg"))).toBe("Photo");
    expect(previewOf(`hi\n${tokenFor("u1/a.jpg")}`)).toBe("hi (photo)");
    expect(previewOf("just words")).toBe("just words");
  });
});

describe("critter avatars", () => {
  it("round-trips a spec", () => {
    const spec = toSpec({ seed: "Pip", eyes: "round", bg: "0369a1" });
    expect(fromSpec(spec)).toEqual({ seed: "Pip", eyes: "round", bg: "0369a1" });
  });
  it("draws every preset and ignores unknown parts", () => {
    for (const p of presets()) expect(critterUri(p).startsWith("data:image/svg+xml")).toBe(true);
    expect(critterUri("critter:x|eyes=nonsense").startsWith("data:image/svg+xml")).toBe(true);
    expect(OPTIONS.eyes.length).toBeGreaterThan(5);
  });
});
