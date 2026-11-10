import { describe, expect, it } from "vitest";
import { hwfFitSize, hwfHex, hwfRadius, hwfStep, hwfWarmth } from "./HalftoneWordmark";

describe("halftone footer helpers", () => {
  it("reads hex colours, short or long, and refuses anything else", () => {
    expect(hwfHex("#ff7a45")).toEqual([255, 122, 69]);
    expect(hwfHex("#fa4")).toEqual([255, 170, 68]);
    expect(hwfHex("rgb(1,2,3)")).toBeNull();
    expect(hwfHex("")).toBeNull();
  });
  it("sizes a dot by the area it covers, within bounds", () => {
    expect(hwfRadius(0, 6)).toBe(0);
    expect(hwfRadius(1, 6)).toBeCloseTo(3.36, 5);
    expect(hwfRadius(2, 6)).toBe(hwfRadius(1, 6)); // coverage is clamped
    expect(hwfRadius(0.25, 6)).toBeCloseTo(hwfRadius(1, 6) / 2, 5); // a quarter of the area is half the radius
  });
  it("pushes a dot away from the pointer and brings it home when the pointer is gone", () => {
    const near = hwfStep(10, 10, 0, 0, 10, 10, 5, 10, 80); // pointer to the left of the dot
    expect(near[0]).toBeGreaterThan(10);
    let s = [30, 40, 0, 0];
    for (let i = 0; i < 400; i++) s = hwfStep(s[0], s[1], s[2], s[3], 10, 10, -1e5, -1e5, 80);
    expect(s[0]).toBeCloseTo(10, 1);
    expect(s[1]).toBeCloseTo(10, 1);
  });
  it("warms a dot by how far it has been pushed from home", () => {
    expect(hwfWarmth(10, 10, 10, 10, 28)).toBe(0);
    expect(hwfWarmth(24, 10, 10, 10, 28)).toBeCloseTo(0.5, 5);
    expect(hwfWarmth(100, 10, 10, 10, 28)).toBe(1);
  });
  it("sizes the word to fill the width", () => {
    expect(hwfFitSize(200, 400)).toBe(200);
    expect(hwfFitSize(0, 400)).toBe(0);
  });
});
