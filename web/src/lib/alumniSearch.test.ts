import { describe, expect, it } from "vitest";
import { companiesOf, matchesAlum, orderAlumni } from "./alumniSearch";
import type { Alum } from "./alumni";

const person = (id: string, over: Partial<Alum> = {}): Alum => ({ id, name: id.toUpperCase(), gradYear: 2023, field: "", company: "", jobTitle: "", industry: "", about: "", openTo: [], listed: true, ...over });
const none = { q: "", want: "" as const, company: "", club: "" };

describe("companiesOf", () => {
  it("counts each place once whatever the capitals, most people first, and skips blanks", () => {
    expect(companiesOf([person("a", { company: "Acme" }), person("b", { company: "acme " }), person("c", { company: "Beta" }), person("d")]))
      .toEqual([{ name: "Acme", count: 2 }, { name: "Beta", count: 1 }]);
  });
});

describe("matchesAlum", () => {
  const a = person("a", { company: "Acme", industry: "Technology", openTo: ["referrals"] });
  const clubs = [{ id: "c1", name: "Nepali Students", mine: true }];
  it("searches club names as well as work", () => {
    expect(matchesAlum(a, { ...none, q: "nepali" }, clubs)).toBe(true);
    expect(matchesAlum(a, { ...none, q: "techno" }, clubs)).toBe(true);
    expect(matchesAlum(a, { ...none, q: "finance" }, clubs)).toBe(false);
  });
  it("needs every filter to agree", () => {
    expect(matchesAlum(a, { ...none, company: "ACME", want: "referrals", club: "c1" }, clubs)).toBe(true);
    expect(matchesAlum(a, { ...none, want: "hiring" }, clubs)).toBe(false);
    expect(matchesAlum(a, { ...none, club: "c2" }, clubs)).toBe(false);
  });
});

describe("orderAlumni", () => {
  it("puts people from your clubs first, then newer classes", () => {
    const list = [person("old", { gradYear: 2020 }), person("new", { gradYear: 2025 }), person("mine", { gradYear: 2019 })];
    const by = new Map([["mine", [{ id: "c1", name: "Club", mine: true }]]]);
    expect(orderAlumni(list, by).map((x) => x.id)).toEqual(["mine", "new", "old"]);
  });
});
