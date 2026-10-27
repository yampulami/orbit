import { describe, expect, it } from "vitest";
import { classesOn, nextClass, problemWith, toMinutes, type ClassSlot } from "./classes";

const calc: ClassSlot = { id: "a", name: "Calc II", days: [1, 3], start: "09:00", end: "10:15", place: "Smith 204" };
const chem: ClassSlot = { id: "b", name: "Chem", days: [1], start: "08:00", end: "08:50" };
// Monday 26 Oct 2026
const monday = (h: number, m = 0) => new Date(2026, 9, 26, h, m);

describe("class schedule", () => {
  it("reads times as minutes", () => { expect(toMinutes("09:05")).toBe(545); });

  it("lists the classes on a day, earliest first", () => {
    expect(classesOn([calc, chem], monday(7)).map((c) => c.name)).toEqual(["Chem", "Calc II"]);
    expect(classesOn([calc, chem], new Date(2026, 9, 27))).toEqual([]); // Tuesday
  });

  it("finds the next class to start", () => {
    expect(nextClass([calc, chem], monday(7))?.slot.name).toBe("Chem");
    expect(nextClass([calc, chem], monday(8, 30))?.slot.name).toBe("Calc II"); // Chem started more than 10 minutes ago
  });

  it("still counts a class that began a few minutes ago", () => {
    expect(nextClass([chem], monday(8, 5))?.slot.name).toBe("Chem");
  });

  it("looks ahead to the next day with a class", () => {
    const next = nextClass([calc], monday(11));
    expect(next?.starts.getDay()).toBe(3); // Wednesday
    expect(next?.starts.getHours()).toBe(9);
  });

  it("says nothing when there are no classes", () => { expect(nextClass([], monday(9))).toBeNull(); });

  it("explains what is wrong with a class", () => {
    expect(problemWith({ name: " ", days: [1], start: "09:00", end: "10:00" })).toMatch(/name/);
    expect(problemWith({ name: "Art", days: [], start: "09:00", end: "10:00" })).toMatch(/day/);
    expect(problemWith({ name: "Art", days: [1], start: "10:00", end: "09:00" })).toMatch(/end after/);
    expect(problemWith({ name: "Art", days: [1], start: "09:00", end: "10:00" })).toBeNull();
  });
});
