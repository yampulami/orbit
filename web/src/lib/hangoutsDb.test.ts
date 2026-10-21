import { describe, expect, it } from "vitest";
import { buildState, type Raw } from "./hangoutsDb";

const ME = "11111111-aaaa", MAYA = "22222222-bbbb", JO = "33333333-cccc", JO2 = "44444444-dddd";
const base: Raw = {
  me: ME,
  groups: [{ id: "g1", name: "Coffee crew" }],
  members: [{ group_id: "g1", user_id: MAYA }, { group_id: "g1", user_id: ME }],
  codes: [{ group_id: "g1", code: "ABCDE12345" }],
  messages: [
    { id: "m2", group_id: "g1", sender_id: MAYA, sender_name: "Maya", body: "Coffee Saturday?", hangout_id: null, created_at: "2026-10-21T10:05:00Z" },
    { id: "m1", group_id: "g1", sender_id: ME, sender_name: "Riley", body: "hi", hangout_id: null, created_at: "2026-10-21T10:00:00Z" },
    { id: "m3", group_id: "g1", sender_id: MAYA, sender_name: "Maya", body: "Coffee break", hangout_id: "h1", created_at: "2026-10-21T10:06:00Z" },
  ],
  hangouts: [{ id: "h1", group_id: "g1", visibility: "group", created_by: MAYA, title: "Coffee break", place_name: "Student Center", starts_at: "2026-10-24T14:00:00Z", duration_minutes: 90, canceled_at: null }],
  rsvps: [{ hangout_id: "h1", user_id: MAYA, answer: "yes" }, { hangout_id: "h1", user_id: ME, answer: "no" }],
  names: { [ME]: "Riley", [MAYA]: "Maya" },
};

describe("buildState", () => {
  it("shows the signed-in student as You, first in the member list", () => {
    const g = buildState(base).groups[0];
    expect(g.members).toEqual(["You", "Maya"]);
    expect(g.code).toBe("ABCDE12345");
  });

  it("keeps chat in time order and turns a hangout message into a card", () => {
    const m = buildState(base).groups[0].messages;
    expect(m.map((x) => x.id)).toEqual(["m1", "m2", "m3"]);
    expect(m[0]).toMatchObject({ author: "You", text: "hi" });
    expect(m[1]).toMatchObject({ author: "Maya", text: "Coffee Saturday?" });
    expect(m[2]).toMatchObject({ hangoutId: "h1" });
    expect(m[2].text).toBeUndefined();
  });

  it("keys answers by who gave them, with You for yourself", () => {
    const h = buildState(base).hangouts[0];
    expect(h.rsvps).toEqual({ Maya: "yes", You: "no" });
    expect(h.by).toBe("Maya");
    expect(h.groupId).toBe("g1");
    expect(h.len).toBe(90);
  });

  it("marks a cancelled hangout, and a public one without a group", () => {
    const s = buildState({ ...base, hangouts: [{ ...base.hangouts[0], canceled_at: "2026-10-22T00:00:00Z" }, { ...base.hangouts[0], id: "h2", group_id: null, visibility: "campus" }] });
    expect(s.hangouts[0].canceled).toBe(true);
    expect(s.hangouts[1]).toMatchObject({ visibility: "campus", groupId: "", canceled: false });
  });

  it("tells two people with the same name apart", () => {
    const s = buildState({
      ...base,
      members: [...base.members, { group_id: "g1", user_id: JO }, { group_id: "g1", user_id: JO2 }],
      names: { ...base.names, [JO]: "Jo", [JO2]: "Jo" },
      rsvps: [{ hangout_id: "h1", user_id: JO, answer: "yes" }, { hangout_id: "h1", user_id: JO2, answer: "no" }],
    });
    const keys = Object.keys(s.hangouts[0].rsvps);
    expect(keys).toContain("Jo 3333");
    expect(keys).toContain("Jo 4444");
    expect(new Set(keys).size).toBe(2);
  });

  it("falls back to the name sent with a message when there is no profile", () => {
    const s = buildState({ ...base, names: { [ME]: "Riley" } });
    expect(s.groups[0].members).toContain("Maya");
  });

  it("is empty, not broken, for a student with no groups", () => {
    expect(buildState({ ...base, groups: [], members: [], codes: [], messages: [], hangouts: [], rsvps: [], names: {} })).toEqual({ groups: [], hangouts: [] });
  });
});
