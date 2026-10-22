import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import { cleanName, nameFor, NAME_MAX, renameMe } from "./displayName";
import { loadProfile, saveProfile, type Profile } from "./profile";

const session = (meta?: { name?: string }, email = "yamii.magarr@gmail.com") => ({ user: { id: "u1", email, user_metadata: meta ?? {} } }) as unknown as Session;
const profile: Profile = { name: "Yamii", campusName: "Caldwell University", campusKey: "caldwell-university", tenure: "first-year", living: "residence", interests: [], streaks: false, nudges: { hangouts: true, reminders: true, places: true }, look: "system", doneAt: "2026-10-21T00:00:00Z" };

/** The tests run without a browser, so give them a small in-memory stand-in for browser storage. */
beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
    clear: () => data.clear(),
  });
});

describe("nameFor", () => {
  it("prefers the name the student chose, then the account name, then the start of the email", () => {
    expect(nameFor(session())).toBe("yamii.magarr");
    expect(nameFor(session({ name: "Account name" }))).toBe("Account name");
    saveProfile("u1", profile);
    expect(nameFor(session({ name: "Account name" }))).toBe("Yamii");
  });
  it("copes with nobody signed in", () => {
    expect(nameFor(null)).toBe("Student");
  });
});

describe("cleanName", () => {
  it("trims, squeezes spaces and caps the length", () => {
    expect(cleanName("  Yamii   M  ")).toBe("Yamii M");
    expect(cleanName("x".repeat(100))).toHaveLength(NAME_MAX);
  });
});

describe("renameMe", () => {
  it("refuses a name that is too short and changes nothing", async () => {
    saveProfile("u1", profile);
    expect(await renameMe(session(), " A ")).toMatch(/at least/);
    expect(loadProfile("u1")?.name).toBe("Yamii");
  });
  it("saves a good name on this device (demo mode has no database)", async () => {
    saveProfile("u1", profile);
    expect(await renameMe(session(), "Yamii M")).toBeNull();
    expect(loadProfile("u1")?.name).toBe("Yamii M");
  });
  it("needs someone signed in", async () => {
    expect(await renameMe(null, "Yamii")).toMatch(/Sign in/);
  });
});
