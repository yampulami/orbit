import { describe, expect, it } from "vitest";
import { clubChoices, clubsByPerson } from "./alumniClubs";

const org = (id: string, name: string, over: Record<string, unknown> = {}) => ({ id, name, status: "active", mine: false, myJoin: "none", members: [], clubMembers: [], ...over }) as never;

describe("clubsByPerson", () => {
  const map = clubsByPerson([
    org("c2", "Robotics", { clubMembers: [{ id: "a", name: "A" }] }),
    org("c1", "Nepali Students", { myJoin: "member", members: [{ id: "a" }], clubMembers: [{ id: "a", name: "A" }, { id: "b", name: "B" }] }),
    org("c3", "Gone", { status: "removed", clubMembers: [{ id: "a", name: "A" }] }),
  ]);
  it("lists each active club once, yours first, and leaves out clubs that are not active", () => {
    expect(map.get("a")?.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(map.get("b")?.map((c) => c.id)).toEqual(["c1"]);
  });
  it("offers only clubs that have one of the listed people, with a count", () => {
    expect(clubChoices(["a", "b", "b", "z"], map).map((c) => [c.id, c.count])).toEqual([["c1", 2], ["c2", 1]]);
    expect(clubChoices(["z"], map)).toEqual([]);
  });
});
