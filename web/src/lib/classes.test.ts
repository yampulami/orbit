import { describe, expect, it } from "vitest";
import { classesOn, classesSoon, nextClass, problemWith, toMinutes, upcomingClasses, type ClassSlot } from "./classes";

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

describe("upcoming classes and the one-hour alert", () => {
  const history: ClassSlot = { id: "h", name: "History", days: [1, 2], start: "13:00", end: "14:00" };

  it("lists the next few classes, soonest first, within two days", () => {
    const list = upcomingClasses([calc, chem, history], monday(7), 3).map((c) => c.slot.name);
    expect(list).toEqual(["Chem", "Calc II", "History"]);
    expect(upcomingClasses([calc, chem, history], monday(7), 2)).toHaveLength(2);
  });

  it("does not look past two days", () => {
    const thursdayOnly: ClassSlot = { id: "t", name: "Lab", days: [4], start: "09:00", end: "10:00" };
    expect(upcomingClasses([thursdayOnly], monday(11))).toEqual([]); // Thursday is about three days away
  });

  it("flags a class that starts within the hour, once per meeting", () => {
    const soon = classesSoon([calc], monday(8, 10));
    expect(soon).toHaveLength(1);
    expect(soon[0].minutes).toBe(50);
    expect(soon[0].key).toBe(classesSoon([calc], monday(8, 40))[0].key); // the same meeting has the same key
    expect(classesSoon([calc], monday(7, 30))).toEqual([]); // 90 minutes away: too early
  });

  it("includes a class that began a moment ago, but not one well under way", () => {
    expect(classesSoon([calc], monday(9, 3))).toHaveLength(1);
    expect(classesSoon([calc], monday(9, 20))).toEqual([]);
  });

  it("gives a different key on a different day", () => {
    const a = classesSoon([calc], monday(8, 30))[0].key;
    const b = classesSoon([calc], new Date(2026, 9, 28, 8, 30))[0].key; // Wednesday
    expect(a).not.toBe(b);
  });
});
