import { describe, expect, it } from "vitest";
import { meters, sameSpot, statusOf, tally } from "./placeVotes";

const votes = (...v: number[]) => Object.fromEntries(v.map((x, i) => [`u${i}`, x as 1 | -1]));

describe("statusOf", () => {
  it("stays open until enough people confirm", () => {
    expect(statusOf({ votes: votes(1, 1) })).toBe("open");
  });
  it("goes live at three confirmations with no objections", () => {
    expect(statusOf({ votes: votes(1, 1, 1) })).toBe("accepted");
  });
  it("needs a clear share, not just three yes votes", () => {
    expect(statusOf({ votes: votes(1, 1, 1, -1, -1) })).toBe("open"); // 3 of 5 is 60%
    expect(statusOf({ votes: votes(1, 1, 1, 1, 1, 1, 1, -1, -1) })).toBe("accepted"); // 7 of 9 is 78%
  });
  it("is dropped when enough people say it is wrong and they lead", () => {
    expect(statusOf({ votes: votes(1, -1, -1, -1) })).toBe("rejected");
  });
  it("counts yes and no votes", () => {
    expect(tally({ votes: votes(1, 1, -1) })).toEqual({ yes: 2, no: 1 });
  });
});

describe("sameSpot", () => {
  const a = { name: "The Quad", lat: 40.8334, lng: -74.2734 };
  it("treats the same name a few meters apart as one place", () => {
    expect(sameSpot(a, { name: "the quad!", lat: 40.83342, lng: -74.27341 })).toBe(true);
  });
  it("keeps the same name far apart as different places", () => {
    expect(sameSpot(a, { name: "The Quad", lat: 40.8354, lng: -74.2734 })).toBe(false);
    expect(meters(a, { lat: 40.8354, lng: -74.2734 })).toBeGreaterThan(150);
  });
  it("keeps different names apart even on the same spot", () => {
    expect(sameSpot(a, { name: "Coffee cart", lat: 40.8334, lng: -74.2734 })).toBe(false);
  });
});
