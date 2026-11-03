import { beforeEach, describe, expect, it } from "vitest";
import { applyProfileRow, patchPerson, personNow, resetDirectory, seedPerson } from "./directory";

describe("the live directory of people", () => {
  beforeEach(() => resetDirectory());

  it("applies a profile change from the database", () => {
    applyProfileRow({ user_id: "u1", display_name: "  Maya R  ", username: "maya", avatar: "critter:Pip", bio: "hi", hobbies: ["Gaming"] });
    expect(personNow("u1")).toMatchObject({ name: "Maya R", username: "maya", avatar: "critter:Pip", bio: "hi", hobbies: ["Gaming"] });
  });
  it("a later change replaces only what it carries", () => {
    applyProfileRow({ user_id: "u1", display_name: "Maya", bio: "first", avatar: "critter:Pip" });
    applyProfileRow({ user_id: "u1", display_name: "Maya Rose", bio: "second" });
    expect(personNow("u1")).toMatchObject({ name: "Maya Rose", bio: "second", avatar: "critter:Pip" });
  });
  it("clearing the avatar is a change too", () => {
    applyProfileRow({ user_id: "u1", display_name: "Maya", avatar: "critter:Pip" });
    applyProfileRow({ user_id: "u1", display_name: "Maya", avatar: null });
    expect(personNow("u1")?.avatar).toBe("");
  });
  it("your own change shows at once, and seeding never overwrites what is known", () => {
    patchPerson("me", { name: "New Name" });
    seedPerson("me", { name: "Old Name", bio: "kept" });
    expect(personNow("me")).toMatchObject({ name: "New Name", bio: "kept" });
  });
  it("ignores a row with no person", () => {
    applyProfileRow({ display_name: "Nobody" });
    expect(personNow(undefined)).toBeUndefined();
  });
});

import { spoken } from "./directory";
describe("saying a name", () => {
  it("shortens an email address to the part before the @, and leaves real names alone", () => {
    expect(spoken("siddant@gmail.com")).toBe("siddant");
    expect(spoken("Maya Rose")).toBe("Maya Rose");
  });
});
