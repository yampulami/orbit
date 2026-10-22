import { describe, expect, it } from "vitest";
import { longEnough, parseQuery, rankPeople } from "./peopleSearch";

const row = (id: string, name: string, username: string | null) => ({ user_id: id, display_name: name, username });
const people = [
  row("1", "Amelia Park", "amelia"),
  row("2", "Sam Amato", "samamato"),
  row("3", "Adam", "adam_k"),
  row("4", "Casey Lee", "am_casey"),
  row("5", "Me", "me_user"),
];

describe("parseQuery", () => {
  it("treats a leading @ as a username search", () => {
    expect(parseQuery("@Casey")).toEqual({ term: "casey", usernameOnly: true });
    expect(parseQuery("  casey ")).toEqual({ term: "casey", usernameOnly: false });
  });
});

describe("longEnough", () => {
  it("needs two letters, or one after an @", () => {
    expect(longEnough("a")).toBe(false);
    expect(longEnough("am")).toBe(true);
    expect(longEnough("@")).toBe(false);
    expect(longEnough("@a")).toBe(true);
  });
});

describe("rankPeople", () => {
  it("puts names and usernames that start with what you typed first", () => {
    expect(rankPeople(people, "am", false).map((p) => p.name)).toEqual(["Amelia Park", "Casey Lee", "Sam Amato", "Adam"]);
  });
  it("ranks an exact username above everything", () => {
    expect(rankPeople(people, "adam", false)[0].name).toBe("Adam");
    expect(rankPeople([row("a", "Adam Z", "adamz"), row("b", "Someone", "adam")], "adam", false)[0].username).toBe("adam");
  });
  it("matches a word inside a longer name", () => {
    expect(rankPeople(people, "park", false).map((p) => p.name)).toEqual(["Amelia Park"]);
  });
  it("looks only at usernames after an @", () => {
    expect(rankPeople(people, "am", true).map((p) => p.username)).toEqual(["amelia", "am_casey", "adam_k", "samamato"]);
    expect(rankPeople(people, "park", true)).toEqual([]);
  });
  it("leaves you out of your own results", () => {
    expect(rankPeople(people, "me", false, "5").map((p) => p.id)).not.toContain("5");
  });
  it("finds nothing when nothing matches", () => {
    expect(rankPeople(people, "zzz", false)).toEqual([]);
  });
});
