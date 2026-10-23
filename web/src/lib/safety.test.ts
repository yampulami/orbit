import { beforeEach, describe, expect, it, vi } from "vitest";

/** A stand-in for the database: remembers what was inserted, and can refuse inserts that use columns the old tables do not have. */
const db = vi.hoisted(() => ({
  inserts: [] as { table: string; row: Record<string, unknown> }[],
  oldTables: false,
  failWith: null as null | { code?: string; message: string },
}));

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        const newColumns = ["blocked_name", "comment_id", "context"].some((c) => c in row);
        if (db.oldTables && newColumns) return { error: { message: `Could not find the '${Object.keys(row).find((k) => ["blocked_name", "comment_id", "context"].includes(k))}' column in the schema cache` } };
        if (db.failWith) return { error: db.failWith };
        db.inserts.push({ table, row });
        return { error: null };
      },
      select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
    channel: () => { const ch = { on: () => ch, subscribe: () => ch }; return ch; },
    removeChannel: () => undefined,
  },
}));

import { bindBlocks, safetyActions, unbindBlocks } from "./safety";

beforeEach(() => { db.inserts = []; db.oldTables = false; db.failWith = null; unbindBlocks(); bindBlocks("me-1"); });

describe("report", () => {
  it("sends the person, post, comment and where it happened", async () => {
    expect(await safetyActions.report({ userId: "u2", postId: "p1", commentId: "c1", reason: "spam", detail: "  buy now  ", context: "comment" })).toBeNull();
    expect(db.inserts[0]).toMatchObject({ table: "content_reports", row: { reporter_id: "me-1", reported_user_id: "u2", post_id: "p1", comment_id: "c1", reason: "spam", detail: "buy now", context: "comment" } });
  });

  it("still goes through before the newest database change, noting where it happened in the text", async () => {
    db.oldTables = true;
    expect(await safetyActions.report({ userId: "u2", postId: "p1", commentId: "c1", reason: "harassment", detail: "rude", context: "comment" })).toBeNull();
    expect(db.inserts).toHaveLength(1);
    expect(db.inserts[0].row.detail).toBe("[comment, comment c1] rude");
    expect("comment_id" in db.inserts[0].row).toBe(false);
  });

  it("shortens a very long note", async () => {
    await safetyActions.report({ userId: "u2", reason: "other", detail: "x".repeat(900) });
    expect((db.inserts[0].row.detail as string).length).toBe(500);
  });

  it("says so when something else goes wrong", async () => {
    db.failWith = { message: "You have sent a lot of reports today. We will look at them." };
    expect(await safetyActions.report({ userId: "u2", reason: "spam" })).toMatch(/lot of reports/);
  });
});

describe("block", () => {
  it("blocks and keeps the name for the blocked list", async () => {
    expect(await safetyActions.block("u2", "Casey")).toBeNull();
    expect(db.inserts[0]).toMatchObject({ table: "user_blocks", row: { blocker_id: "me-1", blocked_id: "u2", blocked_name: "Casey" } });
  });

  it("still blocks before the newest database change (without the name)", async () => {
    db.oldTables = true;
    expect(await safetyActions.block("u2", "Casey")).toBeNull();
    expect(db.inserts).toHaveLength(1);
    expect("blocked_name" in db.inserts[0].row).toBe(false);
  });

  it("treats blocking someone already blocked as fine", async () => {
    db.failWith = { code: "23505", message: "duplicate key" };
    expect(await safetyActions.block("u2", "Casey")).toBeNull();
  });
});
