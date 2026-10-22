import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** A stand-in for the live connection: the test decides when a change arrives and when the connection drops or comes back. */
const live = vi.hoisted(() => ({
  onChange: [] as (() => void)[],
  status: undefined as ((s: string) => void) | undefined,
  removed: 0,
}));

vi.mock("./supabase", () => ({
  supabase: {
    channel: () => {
      const ch = {
        on: (_type: string, _filter: unknown, cb: () => void) => { live.onChange.push(cb); return ch; },
        subscribe: (cb: (s: string) => void) => { live.status = cb; return ch; },
      };
      return ch;
    },
    removeChannel: () => { live.removed += 1; },
  },
}));

import { CONNECT_GRACE_MS, POLL_DOWN_MS, POLL_SAFETY_MS, watchTables } from "./people";

beforeEach(() => { vi.useFakeTimers(); live.onChange = []; live.status = undefined; live.removed = 0; });
afterEach(() => { vi.useRealTimers(); });

const change = () => live.onChange.forEach((f) => f());

describe("watchTables", () => {
  it("looks again shortly after a change, once for a burst of them", () => {
    const seen = vi.fn();
    watchTables("t", ["a"], seen);
    live.status?.("SUBSCRIBED");
    change(); change(); change();
    vi.advanceTimersByTime(249);
    expect(seen).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
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
