import { describe, expect, it } from "vitest";
import { buildFriends, relationTo, type RawFriends } from "./friendsDb";
import { buildNotifs, describe as describeNotif, type RawNotif } from "./notifsDb";
import { checkUsername, normalizeUsername, suggestUsername } from "./username";

const ME = "22222222-bbbb", MAYA = "11111111-aaaa", CASEY = "33333333-cccc", CASEY2 = "44444444-dddd", LEO = "55555555-eeee";

const raw: RawFriends = {
  me: ME,
  friendships: [{ user_low: MAYA, user_high: ME }, { user_low: ME, user_high: CASEY }],
  requests: [
    { id: "r1", from_user: LEO, to_user: ME, status: "pending", created_at: "2026-10-22T10:00:00Z" },
    { id: "r2", from_user: ME, to_user: CASEY2, status: "pending", created_at: "2026-10-22T11:00:00Z" },
    { id: "r3", from_user: CASEY2, to_user: ME, status: "declined", created_at: "2026-10-21T11:00:00Z" },
  ],
  profiles: [
    { user_id: MAYA, display_name: "Maya", username: "maya_k" },
    { user_id: CASEY, display_name: "Casey", username: "casey" },
    { user_id: CASEY2, display_name: "Casey", username: "casey_b" },
    { user_id: LEO, display_name: "Leo", username: null },
  ],
};

describe("buildFriends", () => {
  it("lists friends whichever way round the pair is stored, in name order", () => {
    expect(buildFriends(raw).friends.map((f) => f.username)).toEqual(["casey", "maya_k"]);
  });
  it("separates requests to you from requests you sent, and ignores declined ones", () => {
    const s = buildFriends(raw);
    expect(s.incoming.map((r) => r.from.name)).toEqual(["Leo"]);
    expect(s.outgoing.map((r) => r.to.username)).toEqual(["casey_b"]);
    expect(s.incoming[0].from.username).toBeNull();
  });
  it("tells two people with the same name apart", () => {
    const s = buildFriends(raw);
    expect(s.friends.find((f) => f.id === CASEY)!.name).toBe("Casey 3333");
    expect(s.outgoing[0].to.name).toBe("Casey 4444");
  });
});

describe("relationTo", () => {
  const s = buildFriends(raw);
  it("says how you stand with someone", () => {
    expect(relationTo(s, ME, ME).relation).toBe("self");
    expect(relationTo(s, ME, MAYA).relation).toBe("friends");
    expect(relationTo(s, ME, LEO)).toEqual({ relation: "incoming", requestId: "r1" });
    expect(relationTo(s, ME, CASEY2).relation).toBe("outgoing");
    expect(relationTo(s, ME, "99999999-zzzz").relation).toBe("none");
  });
});

const n = (over: Partial<RawNotif>): RawNotif => ({ id: 1, actor_id: MAYA, kind: "reply", post_id: null, conversation_id: null, body: "replied to your comment", read_at: null, created_at: "2026-10-22T10:00:00Z", ...over });

describe("notifications", () => {
  it("words each kind with the person's name", () => {
    expect(describeNotif(n({}), "Maya").title).toBe("Maya replied to your comment");
    expect(describeNotif(n({ kind: "friend_request", body: "sent you a friend request" }), "Leo")).toMatchObject({ title: "Leo wants to be your friend", to: `/app/people/${MAYA}` });
    expect(describeNotif(n({ kind: "message", body: "Lunch?" }), "Maya")).toMatchObject({ title: "Maya sent you a message", sub: "Lunch?", to: "/app/messages" });
    expect(describeNotif(n({ kind: "group_add", body: "added you to Study squad" }), "Maya")).toMatchObject({ title: "Maya added you to Study squad", to: "/app/groups" });
  });
  it("sorts newest first and marks unread ones", () => {
    const list = buildNotifs([n({ id: 1, created_at: "2026-10-22T09:00:00Z", read_at: "2026-10-22T09:30:00Z" }), n({ id: 2, created_at: "2026-10-22T11:00:00Z" })], ME, { [MAYA]: "Maya" });
    expect(list.map((x) => x.id)).toEqual([2, 1]);
    expect(list.map((x) => x.unread)).toEqual([true, false]);
  });
  it("copes with a person who has since left", () => {
    expect(buildNotifs([n({ actor_id: null })], ME, {})[0].actor).toBe("Someone");
  });
});

describe("usernames", () => {
  it("tidies what was typed", () => {
    expect(normalizeUsername("  @Casey_B ")).toBe("casey_b");
  });
  it("accepts good ones and says what is wrong with bad ones", () => {
    expect(checkUsername("casey_b")).toBeNull();
    expect(checkUsername("ab")).toMatch(/at least 3/);
    expect(checkUsername("x".repeat(21))).toMatch(/20/);
    expect(checkUsername("case y")).toMatch(/letters, numbers/);
    expect(checkUsername("casey!")).toMatch(/letters, numbers/);
  });
  it("suggests one from a name, adding digits when it is taken", () => {
    expect(suggestUsername("Casey Lee")).toBe("caseylee");
    expect(suggestUsername("Casey", (u) => u === "casey")).toBe("casey1");
    expect(suggestUsername("Casey", (u) => u === "casey" || u === "casey1")).toBe("casey2");
  });
  it("makes something valid out of a very short or odd name", () => {
    expect(checkUsername(suggestUsername("Al"))).toBeNull();
    expect(checkUsername(suggestUsername("李"))).toBeNull();
  });
});
