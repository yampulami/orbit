import { describe, expect, it } from "vitest";
import { recent, waitMessage, waitSeconds } from "./attemptLimit";

describe("attempt limit", () => {
  const W = 60_000;
  it("allows tries under the limit", () => { expect(waitSeconds([1000, 2000], 5000, 3, W)).toBe(0); });
  it("blocks at the limit until the oldest counted try leaves the window", () => {
    expect(waitSeconds([1000, 2000, 3000], 5000, 3, W)).toBe(56);
  });
  it("lets old tries expire", () => {
    expect(recent([1000, 70_000], 80_000, W)).toEqual([70_000]);
    expect(waitSeconds([1000, 2000, 3000], 70_000, 3, W)).toBe(0);
  });
  it("words the wait", () => {
    expect(waitMessage(30)).toContain("30 s");
    expect(waitMessage(150)).toContain("3 min");
  });
});
