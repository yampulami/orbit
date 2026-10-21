import { describe, expect, it } from "vitest";
import { buildProposals, type RawPlaces } from "./placesDb";
import { statusOf } from "./placeVotes";

const ME = "11111111-aaaa", MAYA = "22222222-bbbb", LEO = "33333333-cccc", JO = "44444444-dddd", JO2 = "55555555-eeee";
const place = { id: "p1", campus_key: "caldwell-university", name: "The quad", category: "outdoors" as const, lat: 40.83345, lng: -74.27345, blurb: "Open lawn", created_by: MAYA, created_at: "2026-10-21T10:00:00Z" };
const raw: RawPlaces = {
  me: ME,
  places: [place],
  votes: [{ place_id: "p1", user_id: MAYA, vote: 1 }],
  names: { [ME]: "Taylor", [MAYA]: "Maya", [LEO]: "Leo" },
};

describe("buildProposals", () => {
  it("names the author and keeps their first confirmation", () => {
    const p = buildProposals(raw)[0];
    expect(p.by).toBe("Maya");
    expect(p.votes).toEqual({ Maya: 1 });
    expect(p.details).toBe("Open lawn");
    expect(p.campusKey).toBe("caldwell-university");
    expect(statusOf(p)).toBe("open");
  });

  it("shows your own place and your own vote as You", () => {
    const p = buildProposals({ ...raw, places: [{ ...place, created_by: ME }], votes: [{ place_id: "p1", user_id: ME, vote: 1 }] })[0];
    expect(p.by).toBe("You");
    expect(p.votes).toEqual({ You: 1 });
  });

  it("goes live once three different students confirm", () => {
    const p = buildProposals({ ...raw, votes: [{ place_id: "p1", user_id: MAYA, vote: 1 }, { place_id: "p1", user_id: LEO, vote: 1 }, { place_id: "p1", user_id: ME, vote: 1 }] })[0];
    expect(statusOf(p)).toBe("accepted");
    expect(p.votes).toEqual({ Maya: 1, Leo: 1, You: 1 });
  });

  it("keeps each place's votes separate", () => {
    const two = buildProposals({ ...raw, places: [place, { ...place, id: "p2", name: "Coffee cart" }], votes: [{ place_id: "p1", user_id: MAYA, vote: 1 }, { place_id: "p2", user_id: LEO, vote: -1 }] });
    expect(two.find((p) => p.id === "p1")!.votes).toEqual({ Maya: 1 });
    expect(two.find((p) => p.id === "p2")!.votes).toEqual({ Leo: -1 });
  });

  it("tells two voters with the same name apart", () => {
    const p = buildProposals({ ...raw, names: { ...raw.names, [JO]: "Jo", [JO2]: "Jo" }, votes: [{ place_id: "p1", user_id: JO, vote: 1 }, { place_id: "p1", user_id: JO2, vote: -1 }] })[0];
    expect(Object.keys(p.votes).sort()).toEqual(["Jo 4444", "Jo 5555"]);
  });

  it("copes with a place whose author was deleted", () => {
    const p = buildProposals({ ...raw, places: [{ ...place, created_by: null, blurb: null }], votes: [] })[0];
    expect(p.by).toBe("A student");
    expect(p.details).toBeUndefined();
  });
});
