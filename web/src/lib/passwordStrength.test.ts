import { describe, expect, it } from "vitest";
import { guessable, strengthScore } from "./passwordStrength";

describe("password strength", () => {
  it("is empty until something is typed", () => expect(strengthScore("")).toBe(0));
  it("calls common patterns weak however long", () => {
    expect(guessable("Password123!")).toBe(true);
    expect(strengthScore("Password123!")).toBe(1);
    expect(strengthScore("aaaaaaaaaaaa")).toBe(1);
    expect(strengthScore("abcd1234XYZ!")).toBe(1);
  });
  it("counts the rules a password meets", () => {
    expect(strengthScore("tulip")).toBe(1);
    expect(strengthScore("tulipfield")).toBe(1);
    expect(strengthScore("tulipField")).toBe(2);
    expect(strengthScore("tulipField7")).toBe(3);
    expect(strengthScore("tulipField7!")).toBe(4);
  });
});
