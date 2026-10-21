import { describe, expect, it } from "vitest";
import { findConflict, isVisible, type Hangout } from "./hangouts";

const at = (d: number, hh: number, mm = 0) => { const t = new Date(); t.setDate(t.getDate() + d); t.setHours(hh, mm, 0, 0); return t.toISOString(); };

describe("findConflict", () => {
  it("finds a hangout you said yes to at the same time", () => {
    expect(findConflict(at(1, 11, 15))?.title).toBe("Midterm review");
  });
  it("finds an overlap that starts partway through", () => {
    expect(findConflict(at(1, 12, 0))?.title).toBe("Midterm review");
  });
  it("is clear once the other one is over", () => {
    expect(findConflict(at(1, 14, 0))).toBeUndefined();
  });
  it("ignores hangouts you have not agreed to go to", () => {
    // Farmers market run is Tess's plan and unanswered by you, so it does not block its own slot.
    expect(findConflict(at(5, 14, 0))).toBeUndefined();
  });
});

describe("isVisible", () => {
  const base: Hangout = { id: "x", groupId: "g1", title: "t", place: "p", when: new Date().toISOString(), by: "Maya", rsvps: {} };
  it("shows a group hangout to its members only", () => {
    expect(isVisible(base, [{ id: "g1" }])).toBe(true);
    expect(isVisible(base, [{ id: "g2" }])).toBe(false);
  });
  it("shows a public hangout to everyone on campus, even without a group", () => {
    expect(isVisible({ ...base, groupId: "", visibility: "campus" }, [])).toBe(true);
  });
  it("never shows a cancelled hangout", () => {
    expect(isVisible({ ...base, canceled: true, visibility: "campus" }, [{ id: "g1" }])).toBe(false);
  });
});
