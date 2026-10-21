import { describe, expect, it } from "vitest";
import { searchUniversities, type University } from "./universities";

const u = (name: string, country = "US", region = ""): University => ({ name, country, region, domain: "" });
const list = [
  u("Caldwell University"), u("Caldwell Community College and Technical Institute"), u("Columbia University"), u("Cornell University"),
  u("University of Cambridge", "GB"), u("California State University"), u("University of California, Berkeley"), u("Collins Institute"),
  u("Universidad de Córdoba", "ES"), u("Montclair State University"),
];

describe("searchUniversities", () => {
  it("suggests from a single letter, names starting with it first", () => {
    const r = searchUniversities(list, "c").map((x) => x.name);
    expect(r.length).toBeGreaterThan(3);
    expect(r[0].toLowerCase().startsWith("c")).toBe(true);
  });
  it("narrows as more is typed", () => {
    expect(searchUniversities(list, "cald").map((x) => x.name)[0]).toBe("Caldwell University");
    expect(searchUniversities(list, "caldwell u").map((x) => x.name)).toEqual(["Caldwell University"]);
  });
  it("finds a name typed in a different order", () => {
    expect(searchUniversities(list, "university of caldwell")).toEqual([]); // no such name
    expect(searchUniversities(list, "university california").map((x) => x.name)).toContain("University of California, Berkeley");
  });
  it("matches 'University of X' when only X is typed", () => {
    expect(searchUniversities(list, "california").map((x) => x.name)).toContain("University of California, Berkeley");
  });
  it("ignores accents and case", () => {
    expect(searchUniversities(list, "cordoba").map((x) => x.name)).toEqual(["Universidad de Córdoba"]);
    expect(searchUniversities(list, "MONTCLAIR")[0].name).toBe("Montclair State University");
  });
  it("lists the preferred country first on a tie", () => {
    const r = searchUniversities(list, "cam", 5, "GB").map((x) => x.name);
    expect(r[0]).toBe("University of Cambridge");
  });
  it("returns nothing for an empty query and respects the limit", () => {
    expect(searchUniversities(list, "  ")).toEqual([]);
    expect(searchUniversities(list, "c", 2)).toHaveLength(2);
  });
});
