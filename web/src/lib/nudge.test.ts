import { beforeEach, describe, expect, it, vi } from "vitest";

/** A stand-in for the quick channel: records who joined, who left, what was sent, and lets a test deliver a note. */
const net = vi.hoisted(() => ({
  channels: {} as Record<string, { handlers: ((m: { payload?: unknown }) => void)[]; sent: unknown[] }>,
  removed: [] as string[],
}));

vi.mock("./supabase", () => ({
  supabase: {
    channel: (name: string) => {
      const c: { handlers: ((m: { payload?: unknown }) => void)[]; sent: unknown[] } = (net.channels[name] = { handlers: [], sent: [] });
      const ch = {
        name,
        on: (_t: string, _f: unknown, cb: (m: { payload?: unknown }) => void) => { c.handlers.push(cb); return ch; },
        subscribe: () => ch,
        send: async (m: { payload: unknown }) => { c.sent.push(m.payload); return "ok"; },
      };
      return ch;
    },
    removeChannel: async (ch: { name: string }) => { net.removed.push(ch.name); delete net.channels[ch.name]; },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "x1", body: "hi" }, error: null }) }) }) }),
  },
}));

import { fetchChange, listenRooms, sendNudge } from "./nudge";

beforeEach(() => { net.removed = []; for (const k of Object.keys(net.channels)) delete net.channels[k]; listenRooms("a", [], () => undefined); listenRooms("b", [], () => undefined); net.removed = []; });

const deliver = (room: string, payload: unknown) => net.channels[`nudge-${room}`]?.handlers.forEach((f) => f({ payload }));

describe("nudges", () => {
  it("passes on a note for a known table, and ignores anything else", () => {
    const got = vi.fn();
    listenRooms("a", ["r1"], got);
    deliver("r1", { table: "group_messages", id: "m1", op: "upsert" });
    expect(got).toHaveBeenCalledWith({ table: "group_messages", id: "m1", op: "upsert" });
    deliver("r1", { table: "student_profiles", id: "m1", op: "upsert" });
    deliver("r1", { table: "group_messages", id: 5, op: "upsert" });
    deliver("r1", { table: "group_messages", id: "m1", op: "explode" });
    deliver("r1", undefined);
    expect(got).toHaveBeenCalledTimes(1);
  });

  it("leaves a room when it is no longer listed, and joins new ones", () => {
    listenRooms("a", ["r1", "r2"], () => undefined);
    listenRooms("a", ["r2", "r3"], () => undefined);
    expect(net.removed).toEqual(["nudge-r1"]);
    expect(Object.keys(net.channels).sort()).toEqual(["nudge-r2", "nudge-r3"]);
    listenRooms("a", [], () => undefined);
    expect(Object.keys(net.channels)).toEqual([]);
  });

  it("keeps a room open while someone else still listens in it", () => {
    listenRooms("a", ["r1"], () => undefined);
    listenRooms("b", ["r1"], () => undefined);
    listenRooms("a", [], () => undefined);
    expect(net.removed).toEqual([]);
    listenRooms("b", [], () => undefined);
    expect(net.removed).toEqual(["nudge-r1"]);
  });

  it("sends only the table, the id and what happened", () => {
    listenRooms("a", ["r1"], () => undefined);
    sendNudge("r1", { table: "household_expenses", id: "e1", op: "upsert" });
    expect(net.channels["nudge-r1"].sent).toEqual([{ table: "household_expenses", id: "e1", op: "upsert" }]);
    sendNudge(null, { table: "household_expenses", id: "e1", op: "upsert" }); // no room: nothing happens
  });

  it("looks up the row a note points at", async () => {
    expect(await fetchChange("group_messages", "x1")).toEqual({ table: "group_messages", type: "INSERT", row: { id: "x1", body: "hi" }, old: {} });
  });
});
