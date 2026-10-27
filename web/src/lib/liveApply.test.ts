import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ supabase: null }));

import { applyChange } from "./roommatesDb";
import { applyHangChange as applyMessage } from "./hangoutsDb";
import { applyDmChange, type DmThread } from "./dmDb";
import type { Space } from "./roommates";
import type { ChangeEvent } from "./people";
import type { HangState } from "./hangTypes";

const names: Record<string, string> = { me: "You", u2: "Maya" };
const nameOf = (id: string) => names[id];
const ev = (table: string, type: ChangeEvent["type"], row: Record<string, unknown>, old: Record<string, unknown> = {}): ChangeEvent => ({ table, type, row, old });

const space = (): Space => ({ name: "House", members: ["You", "Maya"], groupId: "g1", tasks: [], groceries: [{ id: "q1", name: "Eggs", category: "Dairy", bought: false }], expenses: [], notes: [], payments: [] });

describe("household changes applied straight from the live connection", () => {
  it("shows a new expense at once, newest first", () => {
    const s = space();
    const next = applyChange(s, nameOf, ev("household_expenses", "INSERT", { id: "e1", group_id: "g1", item: "Wifi", cents: 6000, paid_by: "u2", split: ["me", "u2"], created_at: "2026-10-24T10:00:00Z" }));
    expect(next?.expenses).toEqual([{ id: "e1", item: "Wifi", cents: 6000, paidBy: "Maya", split: ["You", "Maya"], at: "2026-10-24T10:00:00Z" }]);
    expect(s.expenses).toHaveLength(0); // the old state is not changed
  });

  it("does not add your own expense twice (it is shown the moment you add it)", () => {
    const row = { id: "e1", group_id: "g1", item: "Wifi", cents: 6000, paid_by: "me", split: ["me"], created_at: "2026-10-24T10:00:00Z" };
    const once = applyChange(space(), nameOf, ev("household_expenses", "INSERT", row))!;
    const twice = applyChange(once, nameOf, ev("household_expenses", "INSERT", row))!;
    expect(twice.expenses).toHaveLength(1);
  });

  it("appends groceries and updates one in place", () => {
    const added = applyChange(space(), nameOf, ev("household_groceries", "INSERT", { id: "q2", group_id: "g1", name: "Milk", category: "Dairy", bought: false }))!;
    expect(added.groceries.map((g) => g.name)).toEqual(["Eggs", "Milk"]);
    const bought = applyChange(added, nameOf, ev("household_groceries", "UPDATE", { id: "q1", group_id: "g1", name: "Eggs", category: "Dairy", bought: true }))!;
    expect(bought.groceries.map((g) => g.bought)).toEqual([true, false]);
  });

  it("removes a deleted item", () => {
    const next = applyChange(space(), nameOf, ev("household_groceries", "DELETE", {}, { id: "q1" }))!;
    expect(next.groceries).toEqual([]);
  });

  it("ignores another household, and asks for a full look for someone not known yet", () => {
    const s = space();
    expect(applyChange(s, nameOf, ev("household_tasks", "INSERT", { id: "t1", group_id: "other", title: "x", assignee: "me", points: 2, done: false, created_at: "2026-10-24T10:00:00Z" }))).toBe(s);
    expect(applyChange(s, nameOf, ev("household_tasks", "INSERT", { id: "t1", group_id: "g1", title: "x", assignee: "stranger", points: 2, done: false, created_at: "2026-10-24T10:00:00Z" }))).toBeNull();
    expect(applyChange(s, nameOf, ev("household_notes", "INSERT", { id: "n1", group_id: "g1", title: "t", body: "b" }))?.notes).toHaveLength(1);
    expect(applyChange(s, nameOf, ev("campus_group_memberships", "INSERT", { group_id: "g1", user_id: "u9" }))).toBeNull();
  });
});

describe("chat messages applied straight from the live connection", () => {
  const state = (): HangState => ({ groups: [{ id: "g1", name: "G", members: ["You", "Maya"], messages: [{ id: "m0", author: "You", text: "hi", at: "2026-10-24T09:00:00Z" }] }], hangouts: [] });
  const msg = (o: Record<string, unknown> = {}) => ev("group_messages", "INSERT", { id: "m1", group_id: "g1", sender_id: "u2", sender_name: "Maya", body: "yo", hangout_id: null, created_at: "2026-10-24T09:01:00Z", ...o });

  it("appends a message from a known person", () => {
    const next = applyMessage(state(), nameOf, msg())!;
    expect(next.groups[0].messages.map((m) => ("text" in m ? m.text : ""))).toEqual(["hi", "yo"]);
  });
  it("does not repeat a message you sent yourself", () => {
    const s = state();
    expect(applyMessage(s, nameOf, msg({ id: "m0", sender_id: "me" }))).toBe(s);
  });
  it("asks for a full look for an unknown group or person", () => {
    expect(applyMessage(state(), nameOf, msg({ group_id: "nope" }))).toBeNull();
    expect(applyMessage(state(), nameOf, msg({ sender_id: "stranger" }))).toBeNull();
  });
  it("shows a message about a plan as a plan card", () => {
    const next = applyMessage(state(), nameOf, msg({ hangout_id: "h1" }))!;
    expect(next.groups[0].messages[1]).toMatchObject({ id: "m1", author: "Maya", hangoutId: "h1" });
  });
});

describe("hangouts and answers applied straight from the live connection", () => {
  const base = (): HangState => ({ groups: [{ id: "g1", name: "G", members: ["You", "Maya"], messages: [] }], hangouts: [
    { id: "h2", groupId: "g1", title: "Later", place: "Lib", when: "2026-10-30T10:00:00Z", by: "You", rsvps: { You: "yes" }, visibility: "group", len: 90 },
  ] });
  const hang = (o: Record<string, unknown> = {}) => ev("campus_hangouts", "INSERT", { id: "h1", group_id: "g1", visibility: "group", created_by: "u2", title: "Coffee", place_name: "Cafe", starts_at: "2026-10-28T10:00:00Z", duration_minutes: 60, canceled_at: null, ...o });

  it("adds a new hangout in time order", () => {
    const next = applyMessage(base(), nameOf, hang())!;
    expect(next.hangouts.map((h) => h.id)).toEqual(["h1", "h2"]);
    expect(next.hangouts[0]).toMatchObject({ title: "Coffee", place: "Cafe", by: "Maya", len: 60, canceled: false, rsvps: {} });
  });
  it("updates a hangout in place and keeps the answers, and hides a cancelled one", () => {
    const once = applyMessage(base(), nameOf, hang({ id: "h2", title: "Later (moved)", canceled_at: "2026-10-24T00:00:00Z" }))!;
    expect(once.hangouts).toHaveLength(1);
    expect(once.hangouts[0]).toMatchObject({ title: "Later (moved)", canceled: true, rsvps: { You: "yes" } });
  });
  it("shows someone's answer, and takes it away again", () => {
    const yes = applyMessage(base(), nameOf, ev("campus_hangout_rsvps", "INSERT", { hangout_id: "h2", user_id: "u2", answer: "no" }))!;
    expect(yes.hangouts[0].rsvps).toEqual({ You: "yes", Maya: "no" });
    const gone = applyMessage(yes, nameOf, ev("campus_hangout_rsvps", "DELETE", {}, { hangout_id: "h2", user_id: "u2" }))!;
    expect(gone.hangouts[0].rsvps).toEqual({ You: "yes" });
  });
  it("asks for a full look for a hangout or person it does not know", () => {
    expect(applyMessage(base(), nameOf, ev("campus_hangout_rsvps", "INSERT", { hangout_id: "nope", user_id: "u2", answer: "yes" }))).toBeNull();
    expect(applyMessage(base(), nameOf, hang({ created_by: "stranger" }))).toBeNull();
  });
});

describe("direct messages applied straight from the live connection", () => {
  const threads = (): DmThread[] => [
    { id: "c1", otherId: "u2", name: "Maya", messages: [], unread: 0, updatedAt: "2026-10-24T08:00:00Z" },
    { id: "c2", otherId: "u3", name: "Sam", messages: [], unread: 0, updatedAt: "2026-10-24T09:00:00Z" },
  ];
  const dm = (o: Record<string, unknown> = {}) => ev("direct_messages", "INSERT", { id: "d1", conversation_id: "c1", sender_id: "u2", body: "hey", read_at: null, created_at: "2026-10-24T10:00:00Z", ...o });

  it("adds the message, counts it as unread, and moves that chat to the top", () => {
    const next = applyDmChange(threads(), "me", dm())!;
    expect(next[0].id).toBe("c1");
    expect(next[0].messages).toHaveLength(1);
    expect(next[0].unread).toBe(1);
  });
  it("does not count your own message as unread, or add it twice", () => {
    const once = applyDmChange(threads(), "me", dm({ sender_id: "me" }))!;
    expect(once[0].unread).toBe(0);
    expect(applyDmChange(once, "me", dm({ sender_id: "me" }))![0].messages).toHaveLength(1);
  });
  it("marks your message Seen when the other person opens it, and ignores their own read marks", () => {
    const sent = applyDmChange(threads(), "me", dm({ sender_id: "me" }))!;
    const seen = applyDmChange(sent, "me", ev("direct_messages", "UPDATE", { id: "d1", conversation_id: "c1", sender_id: "me", body: "hey", read_at: "2026-10-24T10:05:00Z", created_at: "2026-10-24T10:00:00Z" }))!;
    expect(seen[0].messages[0].seenAt).toBe("2026-10-24T10:05:00Z");
    const theirs = applyDmChange(threads(), "me", dm())!;
    const same = applyDmChange(theirs, "me", ev("direct_messages", "UPDATE", { id: "d1", conversation_id: "c1", sender_id: "u2", body: "hey", read_at: "2026-10-24T10:05:00Z", created_at: "2026-10-24T10:00:00Z" }))!;
    expect(same[0].messages[0].seenAt).toBeUndefined();
  });
  it("asks for a full look for a conversation it does not have", () => {
    expect(applyDmChange(threads(), "me", dm({ conversation_id: "nope" }))).toBeNull();
    expect(applyDmChange(threads(), "me", ev("direct_conversations", "INSERT", { id: "c9" }))).toBeNull();
  });
});
