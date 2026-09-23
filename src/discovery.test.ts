import { describe, it, expect } from "vitest";
import { discoverClubs } from "./discovery";
import { emptyProfile } from "./studentProfile";
describe("campus discovery", () => {
  it("ranks interest matches before unrelated clubs", () => {
    const rows = discoverClubs(
      { ...emptyProfile(), hobbies: ["Coding"] },
      "",
      [],
      false,
    );
    expect(rows[0].name).toBe("Code Collective");
    expect(rows[0].reasons).toEqual(["Coding"]);
  });
  it("combines saved and search filters without exposing unsaved matches", () => {
    expect(
      discoverClubs(emptyProfile(), "code", ["Outdoor Club"], true),
    ).toEqual([]);
    expect(
      discoverClubs(emptyProfile(), "code", ["Code Collective"], true).map(
        (x) => x.name,
      ),
    ).toEqual(["Code Collective"]);
  });
  it("matches hobby aliases even when the club name does not contain them", () => {
    expect(
      discoverClubs(emptyProfile(), "photography", [], false)[0].name,
    ).toBe("The Creative Corner");
  });
  it("normalizes query whitespace and interest casing", () => {
    const rows = discoverClubs(
      { ...emptyProfile(), hobbies: [" music "] },
      "  MUSIC ",
      [],
      false,
    );
    expect(rows[0].name).toBe("Campus Sessions");
    expect(rows[0].reasons).toEqual(["Music"]);
  });
  it("does not turn recommendations into saved memberships", () => {
    const saved: string[] = [];
    discoverClubs({ ...emptyProfile(), hobbies: ["Gaming"] }, "", saved, false);
    expect(saved).toEqual([]);
    expect(discoverClubs(emptyProfile(), "", saved, true)).toEqual([]);
  });
});
