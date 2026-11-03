import { describe, expect, it } from "vitest";
import { outranks, permsOf, rankLabel, rankOf, RANK, roleRank, rolesBelow } from "./clubRoles";
import { buildPeople, sectionsOf } from "./clubPeople";

const roles = [{ id: "vp", position: 1 }, { id: "tr", position: 2 }, { id: "ph", position: 3 }];

describe("rank", () => {
  it("orders president, roles, team, members, outsiders", () => {
    const r = (m: Parameters<typeof rankOf>[0], isMember = false) => rankOf(m, roles, isMember);
    expect(r({ role: "owner" })).toBe(0);
    expect(r({ role: "officer", role_id: "vp" })).toBe(11);
    expect(r({ role: "officer", role_id: "tr" })).toBe(12);
    expect(r({ role: "officer" })).toBe(RANK.team);
    expect(r(undefined, true)).toBe(RANK.member);
    expect(r(undefined)).toBe(RANK.none);
    expect(r({ role: "officer", role_id: "gone" })).toBeGreaterThan(RANK.role + 1000);
  });
  it("lets you act only on people ranked below you", () => {
    expect(outranks(11, 12)).toBe(true);
    expect(outranks(11, 11)).toBe(false);
    expect(outranks(12, 11)).toBe(false);
    expect(outranks(0, RANK.member)).toBe(true);
    expect(outranks(0, 0)).toBe(false);
    expect(outranks(RANK.coordinator, 0)).toBe(true);
  });
  it("gives out only roles below your own", () => {
    expect(rolesBelow(12, roles).map((r) => r.id)).toEqual(["ph"]);
    expect(rolesBelow(11, roles).map((r) => r.id)).toEqual(["tr", "ph"]);
    expect(rolesBelow(0, roles)).toHaveLength(3);
    expect(rolesBelow(RANK.coordinator, roles)).toHaveLength(3);
    expect(roleRank({ position: 2 })).toBe(12);
  });
  it("names a rank", () => {
    expect(rankLabel(0)).toBe("President");
    expect(rankLabel(RANK.member)).toBe("Member");
    expect(rankLabel(11, "Vice President")).toBe("Vice President");
    expect(rankLabel(RANK.team)).toBe("Team");
  });
  it("keeps what each role may do", () => {
    expect(permsOf({ role: "officer", role_id: "vp" }, [{ id: "vp", permissions: ["events", "nonsense"] }])).toEqual(["events"]);
  });
});

describe("the people list", () => {
  const org = {
    members: [
      { id: "a", name: "Cam", role: "owner" as const, title: "President", rank: 0 },
      { id: "b", name: "Bea", role: "officer" as const, roleId: "tr", title: "Treasurer", rank: 12 },
      { id: "c", name: "Al", role: "officer" as const, roleId: "vp", title: "Vice President", rank: 11 },
      { id: "d", name: "Dee", role: "officer" as const, rank: RANK.team },
    ],
    clubMembers: [{ id: "a", name: "Cam" }, { id: "e", name: "Eve" }, { id: "f", name: "Zed" }, { id: "g", name: "You" }],
  };
  const people = buildPeople(org);
  it("puts everyone in one list, once", () => { expect(people.map((p) => p.id).sort()).toEqual(["a", "b", "c", "d", "e", "f", "g"]); expect(people.find((p) => p.id === "g")?.self).toBe(true); });
  it("cuts it into sections from the top down", () => {
    expect(sectionsOf(people).map((s) => `${s.label}:${s.people.map((p) => p.name).join(",")}`)).toEqual(["President:Cam", "Vice President:Al", "Treasurer:Bea", "Team:Dee", "Members:Eve,You,Zed"]);
  });
  it("searches by name or role", () => {
    expect(sectionsOf(people, "tre").map((s) => s.label)).toEqual(["Treasurer"]);
    expect(sectionsOf(people, "ev").flatMap((s) => s.people.map((p) => p.name))).toEqual(["Eve"]);
    expect(sectionsOf(people, "nobody")).toEqual([]);
  });
});
