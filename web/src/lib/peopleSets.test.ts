import { describe, expect, it } from "vitest";
import { buildPeopleSets, everyone } from "./peopleSets";

const input = {
  friends: [{ id: "f1", name: "Maya" }, { id: "f2", name: "Jordan" }],
  dorm: ["Maya", "Sam", "You"],
  circles: [{ name: "Run club", people: ["Priya", "sam"] }],
  groups: [{ name: "Coffee crew", members: ["You", "Riley", "Maya"] }],
  exclude: ["You"],
};

describe("people sets", () => {
  it("builds a set per place, leaving out you and anyone twice", () => {
    const sets = buildPeopleSets(input);
    expect(sets.map((s) => s.key)).toEqual(["friends", "dorm", "circles", "hangouts"]);
    expect(sets.find((s) => s.key === "dorm")!.people.map((p) => p.name)).toEqual(["Maya", "Sam"]);
    expect(sets.find((s) => s.key === "hangouts")!.people.map((p) => p.name)).toEqual(["Riley", "Maya"]);
  });
  it("gives a friend's id to the same name found elsewhere, and the name as id otherwise", () => {
    const sets = buildPeopleSets(input);
    expect(sets.find((s) => s.key === "dorm")!.people[0].id).toBe("f1");
    expect(sets.find((s) => s.key === "dorm")!.people[1].id).toBe("Sam");
  });
  it("leaves out empty sets, and lists everyone once", () => {
    expect(buildPeopleSets({ friends: [], dorm: [], circles: [], groups: [] })).toEqual([]);
    expect(everyone(buildPeopleSets(input)).map((p) => p.name)).toEqual(["Maya", "Jordan", "Sam", "Priya", "Riley"]);
  });
});
