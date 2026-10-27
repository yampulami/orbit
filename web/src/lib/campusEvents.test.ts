import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ supabase: null }));

import { applyEventChange, buildEvents, isOpen, problemWithEvent, type RawAnswer, type RawEvent } from "./campusEvents";

const ev = (id: string, starts: string, extra: Partial<RawEvent> = {}): RawEvent => ({ id, host_id: "h1", host_label: "Library", title: "Workshop " + id, description: "", place_name: "Room 2", starts_at: starts, ends_at: null, canceled_at: null, ...extra });
const ans = (event_id: string, user_id: string, answer: RawAnswer["answer"]): RawAnswer => ({ event_id, user_id, answer });
const change = (table: string, type: "INSERT" | "UPDATE" | "DELETE", row: Record<string, unknown>, old: Record<string, unknown> = {}) => ({ table, type, row, old });

describe("campus events", () => {
  it("lists events soonest first with counts and your own answer", () => {
    const list = buildEvents([ev("b", "2026-10-30T10:00:00Z"), ev("a", "2026-10-28T10:00:00Z")], [ans("a", "me", "going"), ans("a", "u2", "going"), ans("a", "u3", "interested")], "me");
    expect(list.map((e) => e.id)).toEqual(["a", "b"]);
    expect(list[0]).toMatchObject({ going: 2, interested: 1, mine: "going", host: "Library", mineHost: false });
    expect(list[1]).toMatchObject({ going: 0, interested: 0, mine: undefined });
  });

  it("knows which events are yours as the host, and which are cancelled", () => {
    const [e] = buildEvents([ev("a", "2026-10-28T10:00:00Z", { host_id: "me", canceled_at: "2026-10-27T00:00:00Z" })], [], "me");
    expect(e.mineHost).toBe(true);
    expect(e.canceled).toBe(true);
  });

  it("counts an event as open until it ends, or three hours after it starts when it has no end", () => {
    const start = "2026-10-28T10:00:00Z";
    expect(isOpen({ startsAt: start }, new Date("2026-10-28T12:30:00Z"))).toBe(true);
    expect(isOpen({ startsAt: start }, new Date("2026-10-28T13:30:00Z"))).toBe(false);
    expect(isOpen({ startsAt: start, endsAt: "2026-10-28T15:00:00Z" }, new Date("2026-10-28T14:00:00Z"))).toBe(true);
  });

  it("explains what is wrong with a new event", () => {
    const now = new Date("2026-10-27T12:00:00Z");
    expect(problemWithEvent({ title: " ", startsAt: "2026-10-28T10:00:00Z" }, now)).toMatch(/title/);
    expect(problemWithEvent({ title: "x", startsAt: "" }, now)).toMatch(/starts/);
    expect(problemWithEvent({ title: "x", startsAt: "2026-10-26T10:00:00Z" }, now)).toMatch(/passed/);
    expect(problemWithEvent({ title: "x", startsAt: "2026-10-28T10:00:00Z", endsAt: "2026-10-28T09:00:00Z" }, now)).toMatch(/end after/);
    expect(problemWithEvent({ title: "x", startsAt: "2026-10-28T10:00:00Z", endsAt: "2026-10-28T11:00:00Z" }, now)).toBeNull();
  });

  it("applies live changes: a new event, an edit, an answer, a removal", () => {
    const s0 = { events: [ev("a", "2026-10-28T10:00:00Z")], answers: [] as RawAnswer[] };
    const added = applyEventChange(s0, change("campus_events", "INSERT", ev("b", "2026-10-29T10:00:00Z")))!;
    expect(added.events.map((e) => e.id)).toEqual(["a", "b"]);
    const edited = applyEventChange(added, change("campus_events", "UPDATE", { ...ev("a", "2026-10-28T10:00:00Z"), title: "Moved" }))!;
    expect(edited.events[0].title).toBe("Moved");
    const answered = applyEventChange(edited, change("campus_event_responses", "INSERT", { event_id: "a", user_id: "u2", answer: "going" }))!;
    expect(answered.answers).toEqual([ans("a", "u2", "going")]);
    const changed = applyEventChange(answered, change("campus_event_responses", "UPDATE", { event_id: "a", user_id: "u2", answer: "interested" }))!;
    expect(changed.answers).toEqual([ans("a", "u2", "interested")]);
    const removedAnswer = applyEventChange(changed, change("campus_event_responses", "DELETE", {}, { event_id: "a", user_id: "u2" }))!;
    expect(removedAnswer.answers).toEqual([]);
    const gone = applyEventChange(removedAnswer, change("campus_events", "DELETE", {}, { id: "a" }))!;
    expect(gone.events.map((e) => e.id)).toEqual(["b"]);
  });

  it("asks for a full look at anything it does not understand", () => {
    expect(applyEventChange({ events: [], answers: [] }, change("campus_events", "INSERT", {}))).toBeNull();
    expect(applyEventChange({ events: [], answers: [] }, change("somewhere_else", "INSERT", { id: "x" }))).toBeNull();
  });
});
