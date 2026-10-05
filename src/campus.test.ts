import { describe, expect, it } from "vitest";
import { campusKey, validCampus } from "./campus";

describe("campus identity", () => {
  it("normalizes harmless spelling differences consistently", () => {
    expect(campusKey("  St. John's University  ")).toBe("st-john-s-university");
    expect(campusKey("University & College")).toBe("university-and-college");
  });
  it("rejects blank or unusable campuses", () => {
    expect(validCampus(" ")).toBe(false);
    expect(validCampus("University of Maryland")).toBe(true);
  });
});
