import { describe, expect, it } from "vitest";
import { metres, padForTravel, spotFor, walkMinutes } from "./travel";

const hall = { name: "Albright Hall", lat: 40.0, lng: -75.0 };
const library = { name: "Main Library", lat: 40.0, lng: -75.0 + 0.0105 }; // about 900 m east
const near = { name: "Student Union", lat: 40.0, lng: -75.0 + 0.0003 };
const places = [hall, library, near];
const cls = (place?: string) => ({ id: "1", name: "Physics", days: [1], start: "10:00", end: "11:00", place });

describe("walking time", () => {
  it("measures distance and turns it into minutes", () => {
    expect(Math.round(metres(hall, library) / 100)).toBe(9);
    expect(walkMinutes(hall, library)).toBeGreaterThanOrEqual(11);
    expect(walkMinutes(hall, hall)).toBe(0);
    expect(walkMinutes(hall, near)).toBe(2);
  });
  it("matches a room in a building to the building", () => {
    expect(spotFor("Albright Hall 302", places)).toBe(hall);
    expect(spotFor("Main Library", places)).toBe(library);
    expect(spotFor("Somewhere unknown", places)).toBeUndefined();
    expect(spotFor("", places)).toBeUndefined();
  });
  it("adds walking room around classes that are far from where you will meet", () => {
    const r = padForTravel([cls("Albright Hall 302"), cls("Mystery Room"), cls(undefined)], places, library);
    expect(r.classes[0].start < "10:00").toBe(true);
    expect(r.classes[0].end > "11:00").toBe(true);
    expect(r.classes[1]).toMatchObject({ start: "10:00", end: "11:00" });
    expect(r.classes[2]).toMatchObject({ start: "10:00", end: "11:00" });
    expect(r.longest).toBeGreaterThan(0);
  });
  it("adds nothing for a class in the building you will meet in", () => {
    const r = padForTravel([cls("Albright Hall")], places, hall);
    expect(r.classes[0]).toMatchObject({ start: "10:00", end: "11:00" });
    expect(r.longest).toBe(0);
  });
});
