import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ supabase: null }));

import { buildOrgs, postableOrgs, problemWithOrg, type RawMember, type RawOrg } from "./campusOrgs";

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
