import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { undo } from "./undo";

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { undo.flushAll(); vi.useRealTimers(); });

const open = (extra: { commit?: () => void | Promise<void>; ms?: number } = {}) => {
  const onUndo = vi.fn();
  const commit = vi.fn(extra.commit ?? (() => {}));
  const id = undo.show("Post deleted", { onUndo, commit, ms: extra.ms });
  return { id, onUndo, commit };
};

describe("undo", () => {
  it("waits before deleting for real", async () => {
    const { commit } = open({ ms: 6000 });
    await vi.advanceTimersByTimeAsync(5900);
    expect(commit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("puts the item back and never deletes when undone", async () => {
    const { id, onUndo, commit } = open({ ms: 6000 });
    undo.undo(id);
    await vi.advanceTimersByTimeAsync(7000);
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
  });

  it("restores the item if the real delete fails", async () => {
    const { onUndo } = open({ commit: () => Promise.reject(new Error("offline")), ms: 1000 });
    await vi.advanceTimersByTimeAsync(1100);
    await vi.advanceTimersByTimeAsync(0);
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("deletes immediately for everything still waiting when the page is closing", async () => {
    const a = open();
    const b = open();
    undo.flushAll();
    await vi.advanceTimersByTimeAsync(0);
    expect(a.commit).toHaveBeenCalledTimes(1);
    expect(b.commit).toHaveBeenCalledTimes(1);
  });
});
