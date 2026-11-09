import { describe, expect, it } from "vitest";
import { addSent, applyDmChange, buildThreads, REQUEST_LIMIT, type RawDms } from "./dmDb";
import { requestCount, unreadDms } from "./dms";

const ME = "22222222-bbbb", STRANGER = "11111111-aaaa", FRIEND = "33333333-cccc", NEW = "44444444-dddd";
const msg = (id: string, conv: string, from: string, at: string) => ({ id, conversation_id: conv, sender_id: from, body: id, read_at: null, created_at: at });
const base: RawDms = {
  me: ME,
  conversations: [
    { id: "req", user_low: STRANGER, user_high: ME, updated_at: "2026-11-09T10:00:00Z", status: "pending", initiator_id: STRANGER },
    { id: "chat", user_low: ME, user_high: FRIEND, updated_at: "2026-11-09T09:00:00Z", status: "accepted", initiator_id: FRIEND },
    { id: "out", user_low: ME, user_high: NEW, updated_at: "2026-11-09T08:00:00Z", status: "pending", initiator_id: ME },
  ],
  messages: [
    msg("r1", "req", STRANGER, "2026-11-09T10:00:00Z"),
    msg("c1", "chat", FRIEND, "2026-11-09T09:00:00Z"),
    msg("o1", "out", ME, "2026-11-09T08:00:00Z"),
  ],
  names: { [ME]: "Me", [STRANGER]: "Stranger", [FRIEND]: "Friend", [NEW]: "Newcomer" },
};
const by = (raw: RawDms, id: string) => buildThreads(raw).find((t) => t.id === id);

describe("message requests", () => {
  it("marks a first message from a non-friend as an incoming request", () => {
    expect(by(base, "req")).toMatchObject({ incoming: true });
    expect(by(base, "req")?.waiting).toBeUndefined();
  });
  it("marks a conversation you started with a non-friend as waiting, and counts what you sent", () => {
    expect(by(base, "out")).toMatchObject({ waiting: true, sent: 1 });
  });
  it("leaves friends and accepted conversations alone", () => {
    expect(by(base, "chat")?.incoming).toBeUndefined();
    expect(by(base, "chat")?.waiting).toBeUndefined();
  });
  it("treats conversations from before requests existed (no status) as normal", () => {
    const old: RawDms = { ...base, conversations: [{ id: "chat", user_low: ME, user_high: FRIEND, updated_at: "2026-11-09T09:00:00Z" }] };
    expect(by(old, "chat")?.incoming).toBeUndefined();
  });
  it("hides a request you deleted, but the sender still sees theirs", () => {
    const declined = (initiator: string): RawDms => ({ ...base, conversations: [{ id: "req", user_low: STRANGER, user_high: ME, updated_at: "2026-11-09T10:00:00Z", status: "declined", initiator_id: initiator }] });
    expect(by(declined(STRANGER), "req")).toBeUndefined();
    expect(by(declined(ME), "req")).toMatchObject({ waiting: true });
  });
  it("keeps strangers out of the unread number and counts requests on their own", () => {
    const threads = buildThreads(base);
    expect(unreadDms(threads)).toBe(1); // only the friend's message
    expect(requestCount(threads)).toBe(1);
  });
  it("counts the messages you send while it is only a request", () => {
    const out = buildThreads(base).filter((t) => t.id === "out");
    const next = addSent(out, "out", { id: "o2", text: "hi again", at: "2026-11-09T11:00:00Z" });
    expect(next[0].sent).toBe(2);
    expect(REQUEST_LIMIT).toBe(3);
  });
  it("asks for a fresh look when a request is accepted or deleted", () => {
    const threads = buildThreads(base);
    const accepted = { table: "direct_conversations", type: "UPDATE" as const, row: { id: "req", user_low: STRANGER, user_high: ME, updated_at: "2026-11-09T12:00:00Z", status: "accepted", initiator_id: STRANGER }, old: {} };
    expect(applyDmChange(threads, ME, accepted as never)).toBeNull();
    const declined = { ...accepted, row: { ...accepted.row, status: "declined" } };
    expect(applyDmChange(threads, ME, declined as never)).toBeNull();
  });
  it("applies a plain time change to a normal chat without a fresh look", () => {
    const threads = buildThreads(base);
    const touch = { table: "direct_conversations", type: "UPDATE" as const, row: { id: "chat", user_low: ME, user_high: FRIEND, updated_at: "2026-11-09T13:00:00Z", status: "accepted", initiator_id: FRIEND }, old: {} };
    expect(applyDmChange(threads, ME, touch as never)).not.toBeNull();
  });
});
