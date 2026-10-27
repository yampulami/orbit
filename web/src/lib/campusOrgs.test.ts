import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ supabase: null }));

import { buildOrgs, EMPTY_APP, eventsNeedApproval, postableOrgs, problemWithOrg, type RawMember, type RawOrg } from "./campusOrgs";

const org = (id: string, name: string, status: RawOrg["status"] = "active", kind: RawOrg["kind"] = "student"): RawOrg => ({ id, name, description: "", kind, status, created_by: "u1" });
const mem = (org_id: string, user_id: string, role: RawMember["role"] = "officer"): RawMember => ({ org_id, user_id, role });

describe("organizations", () => {
  it("lists active ones first, then waiting, paused and declined, by name", () => {
    const list = buildOrgs([org("a", "Zeta", "paused"), org("b", "Beta", "active"), org("c", "Alpha", "pending"), org("d", "Gamma", "active")], [], "me");
    expect(list.map((o) => o.name)).toEqual(["Beta", "Gamma", "Alpha", "Zeta"]);
  });

  it("knows which ones are yours, and which you own", () => {
    const list = buildOrgs([org("a", "Chess"), org("b", "Film")], [mem("a", "me", "owner"), mem("b", "me", "officer"), mem("b", "u2", "owner")], "me", { u2: "Jordan" });
    expect(list.find((o) => o.id === "a")).toMatchObject({ mine: true, owner: true });
    expect(list.find((o) => o.id === "b")).toMatchObject({ mine: true, owner: false });
    expect(list.find((o) => o.id === "b")?.members.map((m) => m.name)).toEqual(["Jordan", "You"]); // owner first
  });

  it("can only post as an organization that is yours and active", () => {
    const list = buildOrgs([org("a", "Chess"), org("b", "Film", "pending"), org("c", "Art", "paused"), org("d", "Drama")], [mem("a", "me"), mem("b", "me"), mem("c", "me")], "me");
    expect(postableOrgs(list).map((o) => o.name)).toEqual(["Chess"]);
  });

  it("explains what is wrong with a request", () => {
    expect(problemWithOrg({ name: " ", description: "" })).toMatch(/name/);
    expect(problemWithOrg({ name: "x".repeat(90), description: "" })).toMatch(/long/);
    expect(problemWithOrg({ name: "Chess Club", description: "y".repeat(400) })).toMatch(/300/);
    expect(problemWithOrg({ name: "Chess Club", description: "We play." })).toBeNull();
  });
});

describe("eventsNeedApproval", () => {
  it("waits for review unless the club is official or trusted", () => {
    expect(eventsNeedApproval({ kind: "student", trusted: false })).toBe(true);
    expect(eventsNeedApproval({ kind: "student", trusted: true })).toBe(false);
    expect(eventsNeedApproval({ kind: "official", trusted: false })).toBe(false);
  });
});

describe("club applications and joining", () => {
  const full = { ...EMPTY_APP, purpose: "A weekly chess night open to every student on campus.", advisorName: "Dr. Lee", advisorEmail: "lee@uni.edu", meeting: "Thursdays 6 PM", contact: "me@uni.edu" };
  it("needs the details a coordinator reads", () => {
    expect(problemWithOrg({ name: "Chess", description: "" }, EMPTY_APP)).toMatch(/what the club is for/);
    expect(problemWithOrg({ name: "Chess", description: "" }, { ...full, advisorEmail: "nope" })).toMatch(/adviser/);
    expect(problemWithOrg({ name: "Chess", description: "" }, full)).toBeNull();
  });
  it("shows requests to officers and my own place in a club", () => {
    const org: RawOrg = { id: "o", name: "Chess", description: "", kind: "student", status: "active", created_by: "a" };
    const members: RawMember[] = [{ org_id: "o", user_id: "a", role: "owner" }];
    const club = [{ org_id: "o", user_id: "b", status: "pending" as const, message: "hi" }, { org_id: "o", user_id: "c", status: "member" as const }];
    const asOfficer = buildOrgs([org], members, "a", { b: "Bea" }, club)[0];
    expect(asOfficer.requests.map((r) => r.name)).toEqual(["Bea"]);
    expect(asOfficer.memberCount).toBe(1);
    expect(asOfficer.myJoin).toBe("officer");
    expect(buildOrgs([org], members, "b", {}, club)[0].myJoin).toBe("pending");
    expect(buildOrgs([org], members, "z", {}, club)[0].myJoin).toBe("none");
  });
});
