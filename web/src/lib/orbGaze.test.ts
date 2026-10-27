import { describe, expect, it } from "vitest";
import { lookToward, moodTiming } from "./orbGaze";

const box = { left: 100, top: 100, width: 100, height: 100 };

describe("lookToward", () => {
  it("looks toward the point, with up as positive", () => {
    const right = lookToward(box, 600, 150);
    expect(right.x).toBeGreaterThan(0.9);
    expect(Math.abs(right.y)).toBeLessThan(0.05);
    expect(lookToward(box, 150, -300).y).toBeGreaterThan(0.9);
    expect(lookToward(box, -400, 150).x).toBeLessThan(-0.9);
  });
  it("pulls less when the point is close, and rests on the orb itself", () => {
    const near = lookToward(box, 215, 150);
    expect(near.x).toBeGreaterThan(0);
    expect(near.x).toBeLessThan(0.8);
    expect(lookToward(box, 150, 150)).toEqual({ x: 0, y: 0.08 });
  });
  it("never goes past 1", () => {
    const far = lookToward(box, 9000, -9000);
    expect(Math.hypot(far.x, far.y)).toBeLessThanOrEqual(1.0001);
  });
});

describe("moodTiming", () => {
  it("makes loading orbs dart about and sleepy ones barely move", () => {
    expect(moodTiming("loading").glance[1]).toBeLessThan(moodTiming("idle").glance[0] + 1);
    expect(moodTiming("sleepy").spread).toBeLessThan(moodTiming("idle").spread);
  });
});
