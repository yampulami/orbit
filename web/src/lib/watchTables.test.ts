import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** A stand-in for the live connection: the test decides when a change arrives and when the connection drops or comes back. */
const live = vi.hoisted(() => ({
  onChange: [] as ((p?: unknown) => void)[],
  status: undefined as ((s: string) => void) | undefined,
  removed: 0,
}));

vi.mock("./supabase", () => ({
  supabase: {
    channel: () => {
      const ch = {
        on: (_type: string, _filter: unknown, cb: (p?: unknown) => void) => { live.onChange.push(cb); return ch; },
        subscribe: (cb: (s: string) => void) => { live.status = cb; return ch; },
      };
      return ch;
    },
    removeChannel: () => { live.removed += 1; },
  },
}));

import { COALESCE_MS, CONNECT_GRACE_MS, POLL_DOWN_MS, POLL_SAFETY_MS, PROBE_MS, staleLimiter, watchTables } from "./people";

beforeEach(() => { vi.useFakeTimers(); live.onChange = []; live.status = undefined; live.removed = 0; });
afterEach(() => { vi.useRealTimers(); });

const change = (payload?: unknown) => live.onChange.forEach((f) => f(payload));

describe("watchTables", () => {
  it("looks at once on a change, and folds a burst that follows into one more look", () => {
    const seen = vi.fn();
    watchTables("t", ["a"], seen);
    live.status?.("SUBSCRIBED");
    change();
    expect(seen).toHaveBeenCalledTimes(1);
    change(); change();
    expect(seen).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(COALESCE_MS + 1);
    expect(seen).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(COALESCE_MS * 3);
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it("applies a change that arrives with its row straight away, and falls back to looking again when it cannot", () => {
    const seen = vi.fn();
    const applied = vi.fn((e: { table: string }) => e.table === "a");
    watchTables("t", ["a", "b"], seen, applied);
    live.status?.("SUBSCRIBED");
    change({ table: "a", eventType: "INSERT", new: { id: 1 }, old: {} });
    expect(applied).toHaveBeenCalledWith({ table: "a", type: "INSERT", row: { id: 1 }, old: {} });
    expect(seen).not.toHaveBeenCalled(); // handled, so no reload
    vi.advanceTimersByTime(COALESCE_MS * 2);
    change({ table: "b", eventType: "UPDATE", new: { id: 2 }, old: {} });
    expect(seen).toHaveBeenCalledTimes(1); // not handled, so it looks again
  });

  it("asks a cheap question every few seconds and only looks again when the answer is yes", async () => {
    const seen = vi.fn();
    let stale = false;
    const probe = vi.fn(async () => stale);
    watchTables("t", ["a"], seen, undefined, probe);
    live.status?.("SUBSCRIBED");
    await vi.advanceTimersByTimeAsync(PROBE_MS * 2 + 10);
    expect(probe).toHaveBeenCalledTimes(2);
    expect(seen).not.toHaveBeenCalled();
    stale = true;
    await vi.advanceTimersByTimeAsync(PROBE_MS);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("does nothing on its own while the connection is healthy, until the slow safety check", () => {
    const seen = vi.fn();
    watchTables("t", ["a"], seen);
    live.status?.("SUBSCRIBED");
    vi.advanceTimersByTime(POLL_SAFETY_MS - 1000);
    expect(seen).not.toHaveBeenCalled();
    vi.advanceTimersByTime(POLL_DOWN_MS);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("looks again on a timer when the connection never comes up", () => {
    const seen = vi.fn();
    watchTables("t", ["a"], seen);
    vi.advanceTimersByTime(CONNECT_GRACE_MS + 1);
    expect(seen).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(POLL_DOWN_MS * 3);
    expect(seen.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it("looks again on a timer while the connection is down, and catches up the moment it returns", () => {
    const seen = vi.fn();
    watchTables("t", ["a"], seen);
    live.status?.("SUBSCRIBED");
    live.status?.("CHANNEL_ERROR");
    vi.advanceTimersByTime(POLL_DOWN_MS + 1);
    expect(seen).toHaveBeenCalledTimes(1);

    live.status?.("SUBSCRIBED"); // back: what was missed is fetched at once
    vi.advanceTimersByTime(300);
    expect(seen).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(POLL_DOWN_MS * 3); // and the frequent checks stop
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it("stops everything when told to", () => {
    const seen = vi.fn();
    const stop = watchTables("t", ["a"], seen);
    stop();
    change();
    vi.advanceTimersByTime(POLL_SAFETY_MS * 2);
    expect(seen).not.toHaveBeenCalled();
    expect(live.removed).toBe(1);
  });
});

describe("staleLimiter", () => {
  it("says out of date only a few times for the same newest thing", () => {
    const limit = staleLimiter(2);
    expect([limit("a", true), limit("a", true), limit("a", true)]).toEqual([true, true, false]);
    expect(limit("b", true)).toBe(true); // something newer: counted afresh
    expect(limit("b", false)).toBe(false);
  });
});
