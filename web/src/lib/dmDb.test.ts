import { describe, expect, it } from "vitest";
import { buildThreads, pairOf, type RawDms } from "./dmDb";

const ME = "22222222-bbbb", MAYA = "11111111-aaaa", JO = "33333333-cccc", JO2 = "44444444-dddd";
const raw: RawDms = {
  me: ME,
  conversations: [
    { id: "c1", user_low: MAYA, user_high: ME, updated_at: "2026-10-21T10:00:00Z" },
    { id: "c2", user_low: ME, user_high: JO, updated_at: "2026-10-21T12:00:00Z" },
  ],
  messages: [
    { id: "m2", conversation_id: "c1", sender_id: ME, body: "Yes!", read_at: null, created_at: "2026-10-21T10:00:00Z" },
    { id: "m1", conversation_id: "c1", sender_id: MAYA, body: "Club fair tomorrow?", read_at: null, created_at: "2026-10-21T09:00:00Z" },
    { id: "m3", conversation_id: "c2", sender_id: JO, body: "Carpool Thursday?", read_at: "2026-10-21T12:05:00Z", created_at: "2026-10-21T12:00:00Z" },
  ],
  names: { [ME]: "Taylor", [MAYA]: "Maya", [JO]: "Jo" },
};

describe("buildThreads", () => {
  it("puts the newest conversation first and names the other person", () => {
    const t = buildThreads(raw);
    expect(t.map((x) => x.name)).toEqual(["Jo", "Maya"]);
    expect(t[1].otherId).toBe(MAYA);
  });
  it("orders messages oldest first and marks which are yours", () => {
    const maya = buildThreads(raw)[1];
    expect(maya.messages.map((m) => m.text)).toEqual(["Club fair tomorrow?", "Yes!"]);
    expect(maya.messages.map((m) => m.mine)).toEqual([false, true]);
  });
  it("counts only unread messages from the other person", () => {
    const t = buildThreads(raw);
    expect(t[1].unread).toBe(1); // Maya's message has no read time; yours does not count
    expect(t[0].unread).toBe(0); // Jo's was read
  });
  it("keeps two people with the same name apart", () => {
    const t = buildThreads({ ...raw, conversations: [...raw.conversations, { id: "c3", user_low: ME, user_high: JO2, updated_at: "2026-10-20T00:00:00Z" }], names: { ...raw.names, [JO2]: "Jo" } });
    expect(t.map((x) => x.name)).toContain("Jo 3333");
    expect(t.map((x) => x.name)).toContain("Jo 4444");
  });
  it("shows a conversation with no messages yet", () => {
    const t = buildThreads({ ...raw, messages: [] });
    expect(t[0].messages).toEqual([]);
    expect(t[0].unread).toBe(0);
  });
});

describe("pairOf", () => {
  it("puts the lower id first whichever way round", () => {
    expect(pairOf(ME, MAYA)).toEqual({ user_low: MAYA, user_high: ME });
    expect(pairOf(MAYA, ME)).toEqual({ user_low: MAYA, user_high: ME });
  });
});
