import { beforeEach, describe, expect, it, vi } from "vitest";

/** A small stand-in for the database: tables hold rows, and every write is remembered. */
const db = vi.hoisted(() => ({ tables: {} as Record<string, Record<string, unknown>[]>, writes: [] as { table: string; op: string; row: Record<string, unknown> }[] }));

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({ eq: (_col: string, value: unknown) => ({ maybeSingle: async () => ({ data: (db.tables[table] ?? []).find((r) => Object.values(r).includes(value)) ?? null, error: null }) }) }),
      insert: async (row: Record<string, unknown>) => { db.writes.push({ table, op: "insert", row }); return { error: null }; },
      upsert: async (row: Record<string, unknown>) => { db.writes.push({ table, op: "upsert", row }); return { error: null }; },
    }),
  },
}));

import { ensureProfileRow, saveProfile, type Profile } from "./profile";

const profile: Profile = { name: "Yamii", campusName: "Caldwell University", campusKey: "caldwell-university", tenure: "first-year", living: "residence", interests: [], streaks: false, nudges: { hangouts: true, reminders: true, places: true }, look: "system", doneAt: "2026-10-21T00:00:00Z" };

beforeEach(() => {
  db.tables = {}; db.writes = [];
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); }, clear: () => data.clear(),
  });
});

describe("ensureProfileRow", () => {
  it("does nothing when the student already has a profile row", async () => {
    db.tables.student_profiles = [{ user_id: "u1", display_name: "Yamii" }];
    await ensureProfileRow("u1", "someone");
    expect(db.writes).toEqual([]);
  });

  it("saves the answers kept on this device when the row is missing", async () => {
    saveProfile("u1", profile);
    await ensureProfileRow("u1", "someone");
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0]).toMatchObject({ table: "student_profiles", op: "upsert", row: { user_id: "u1", display_name: "Yamii", campus_key: "caldwell-university" } });
  });

  it("makes a row with just a name for an older account that has a campus but no saved answers", async () => {
    db.tables.campus_memberships = [{ user_id: "u1", campus_key: "caldwell-university" }];
    await ensureProfileRow("u1", "  yamii   m ");
    expect(db.writes).toEqual([{ table: "student_profiles", op: "insert", row: { user_id: "u1", campus_key: "caldwell-university", display_name: "yamii m" } }]);
  });

  it("leaves a student who has not picked a campus yet to onboarding", async () => {
    await ensureProfileRow("u1", "someone");
    expect(db.writes).toEqual([]);
  });
});
