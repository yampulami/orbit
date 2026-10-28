import { describe, expect, it } from "vitest";
import { shareTargets } from "./ShareMenu";

describe("shareTargets", () => {
  const t = shareTargets("Free coffee at the library & more", "Riley", "https://orbit.test/app/feed?post=7");
  it("builds an email with the words and the link", () => {
    expect(t.email.startsWith("mailto:?subject=")).toBe(true);
    expect(decodeURIComponent(t.email)).toContain("https://orbit.test/app/feed?post=7");
    expect(decodeURIComponent(t.email)).toContain("Riley on Orbit");
  });
  it("encodes the link for each place it can go", () => {
    expect(t.x).toContain(encodeURIComponent("https://orbit.test/app/feed?post=7"));
    expect(t.facebook).toContain("sharer.php?u=");
    expect(decodeURIComponent(t.whatsapp)).toContain("Free coffee at the library & more");
  });
});
