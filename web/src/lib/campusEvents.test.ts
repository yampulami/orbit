import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ supabase: null }));

import { applyEventChange, buildEvents, canReview, isOpen, outcomeFor, problemWithEvent, statusNote, visibleEvents, type RawAnswer, type RawEvent } from "./campusEvents";

const ev = (id: string, starts: string, extra: Partial<RawEvent> = {}): RawEvent => ({ id, host_id: "h1", host_label: "Library", title: "Workshop " + id, description: "", place_name: "Room 2", starts_at: starts, ends_at: null, canceled_at: null, kind: "official", status: "published", ...extra });
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

describe("official and student events", () => {
  it("publishes staff and coordinator events at once, and holds student events for approval", () => {
    expect(outcomeFor("staff")).toEqual({ kind: "official", status: "published" });
    expect(outcomeFor("coordinator")).toEqual({ kind: "official", status: "published" });
    expect(outcomeFor("student")).toEqual({ kind: "student", status: "pending" });
  });

  it("lets only staff and coordinators review", () => {
    expect(canReview("staff")).toBe(true);
    expect(canReview("coordinator")).toBe(true);
    expect(canReview("student")).toBe(false);
    expect(canReview(null)).toBe(false);
  });

  it("carries the kind and status to the screen", () => {
    const [e] = buildEvents([ev("a", "2026-10-28T10:00:00Z", { kind: "student", status: "pending", review_note: "Room taken" })], [], "me");
    expect(e).toMatchObject({ kind: "student", status: "pending", note: "Room taken" });
  });

  it("shows waiting and declined events only to their host and to reviewers", () => {
    const list = buildEvents([
      ev("pub", "2026-10-28T10:00:00Z"),
      ev("wait", "2026-10-29T10:00:00Z", { kind: "student", status: "pending", host_id: "club" }),
      ev("mine", "2026-10-30T10:00:00Z", { kind: "student", status: "pending", host_id: "me" }),
      ev("no", "2026-10-31T10:00:00Z", { kind: "student", status: "rejected", host_id: "club" }),
    ], [], "me");
    expect(visibleEvents(list, false).map((e) => e.id)).toEqual(["pub", "mine"]);
    expect(visibleEvents(list, true).map((e) => e.id)).toEqual(["pub", "wait", "mine", "no"]);
  });
});

describe("removed events and organizations", () => {
  it("shows a removed event only to its host and to reviewers", () => {
    const list = buildEvents([ev("pub", "2026-10-28T10:00:00Z"), ev("gone", "2026-10-29T10:00:00Z", { status: "removed", host_id: "club" }), ev("mine", "2026-10-30T10:00:00Z", { status: "removed", host_id: "me" })], [], "me");
    expect(visibleEvents(list, false).map((e) => e.id)).toEqual(["pub", "mine"]);
    expect(visibleEvents(list, true).map((e) => e.id)).toEqual(["pub", "gone", "mine"]);
  });
  it("says in words why an event is not live", () => {
    expect(statusNote("pending")).toMatch(/approval/);
    expect(statusNote("removed")).toMatch(/Removed/);
    expect(statusNote("published")).toBe("");
  });
  it("carries the organization an event was posted as", () => {
    const [e] = buildEvents([ev("a", "2026-10-28T10:00:00Z", { org_id: "org1", host_label: "Robotics Club", kind: "student" })], [], "me");
    expect(e).toMatchObject({ orgId: "org1", host: "Robotics Club", kind: "student" });
  });
});
