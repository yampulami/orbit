import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearCaches, readCache, writeCache } from "./localCache";

/** A tiny stand-in for the browser's storage, since the tests run without a browser. Object.keys() on it lists what was saved. */
function fakeStorage() {
  const data = new Map<string, string>();
  const api = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } };
  return new Proxy(api, { ownKeys: () => [...data.keys()], getOwnPropertyDescriptor: (_t, k) => (data.has(String(k)) ? { enumerable: true, configurable: true, value: data.get(String(k)) } : undefined) });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("localStorage", fakeStorage());
  clearCaches();
});

describe("local cache", () => {
  it("keeps what was written, for the same person only", () => {
    writeCache("hang", "u1", { groups: [1] });
    expect(readCache("hang", "u1")).toBeNull(); // saved a moment later, not at once
    vi.advanceTimersByTime(500);
    expect(readCache("hang", "u1")).toEqual({ groups: [1] });
    expect(readCache("hang", "u2")).toBeNull();
  });
  it("saves a burst of changes as one write, keeping the latest", () => {
    writeCache("dms", "u1", [1]); writeCache("dms", "u1", [1, 2]); writeCache("dms", "u1", [1, 2, 3]);
    vi.advanceTimersByTime(500);
    expect(readCache("dms", "u1")).toEqual([1, 2, 3]);
  });
  it("forgets everything on sign out, including what had not been saved yet", () => {
    writeCache("a", "u1", 1); vi.advanceTimersByTime(500); writeCache("b", "u1", 2);
    clearCaches(); vi.advanceTimersByTime(500);
    expect(readCache("a", "u1")).toBeNull();
    expect(readCache("b", "u1")).toBeNull();
  });
  it("does not keep something too large", () => {
    writeCache("big", "u1", "x".repeat(600_000)); vi.advanceTimersByTime(500);
    expect(readCache("big", "u1")).toBeNull();
  });
});
