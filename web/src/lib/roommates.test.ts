import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { autoAssignee, money, netBalances, parseCents, settlements, workload, type Expense, type Task } from "./roommates";

const NOW = new Date(2026, 9, 21, 12);
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => vi.useRealTimers());

const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();
const task = (assignee: string, points: Task["points"], done = false, doneDaysAgo = 1): Task => ({
  id: Math.random().toString(36).slice(2), title: "x", assignee, points, done, createdAt: daysAgo(10), doneAt: done ? daysAgo(doneDaysAgo) : undefined,
});
const expense = (cents: number, paidBy: string, split: string[]): Expense => ({ id: Math.random().toString(36).slice(2), item: "x", cents, paidBy, split, at: daysAgo(1) });

const members = ["You", "Maya", "Jordan"];

describe("workload and auto-assign", () => {
  it("counts open points and recent done points separately", () => {
    const w = workload(members, [task("You", 3), task("You", 2, true, 5), task("Maya", 5, true, 45)]);
    expect(w.You).toEqual({ open: 3, openCount: 1, done: 2 });
    expect(w.Maya.done).toBe(0); // finished more than 30 days ago
  });

  it("picks the roommate with the least open work", () => {
    expect(autoAssignee(members, [task("You", 5), task("Maya", 1)])).toBe("Jordan");
    expect(autoAssignee(members, [task("You", 5), task("Maya", 1), task("Jordan", 2)])).toBe("Maya");
  });

  it("breaks ties by fewer open chores, then by list order", () => {
    expect(autoAssignee(members, [task("You", 1), task("You", 1), task("Maya", 2), task("Jordan", 2)])).toBe("Maya");
    expect(autoAssignee(members, [])).toBe("You");
  });

  it("ignores finished chores when balancing", () => {
    expect(autoAssignee(members, [task("You", 5, true), task("Maya", 1), task("Jordan", 1)])).toBe("You");
  });
});

describe("balances", () => {
  it("splits a bill equally and credits the payer", () => {
    const net = netBalances(members, [expense(3000, "Maya", members)]);
    expect(net).toEqual({ You: -1000, Maya: 2000, Jordan: -1000 });
  });

  it("never loses a cent when a bill does not divide evenly", () => {
    const net = netBalances(members, [expense(1000, "You", members)]);
    expect(Object.values(net).reduce((a, b) => a + b, 0)).toBe(0);
    expect(net.You).toBe(1000 - 334);
  });

  it("adds up several expenses", () => {
    const net = netBalances(members, [expense(3000, "Maya", members), expense(3000, "You", members)]);
    expect(net).toEqual({ You: 1000, Maya: 1000, Jordan: -2000 });
  });

  it("supports a split among only some people", () => {
    const net = netBalances(members, [expense(2000, "You", ["You", "Maya"])]);
    expect(net).toEqual({ You: 1000, Maya: -1000, Jordan: 0 });
  });
});

describe("settlements", () => {
  it("uses the fewest payments", () => {
    expect(settlements({ You: -1000, Maya: 2000, Jordan: -1000 })).toEqual([
      { from: "You", to: "Maya", cents: 1000 },
      { from: "Jordan", to: "Maya", cents: 1000 },
    ]);
  });

  it("settles to zero", () => {
    const net = { A: -700, B: -300, C: 600, D: 400 };
    const paid: Record<string, number> = { ...net };
    for (const s of settlements(net)) { paid[s.from] += s.cents; paid[s.to] -= s.cents; }
    expect(Object.values(paid).every((v) => v === 0)).toBe(true);
  });

  it("returns nothing when everyone is even", () => {
    expect(settlements({ A: 0, B: 0 })).toEqual([]);
  });
});

describe("money input", () => {
  it("parses common amounts", () => {
    expect(parseCents("12.5")).toBe(1250);
    expect(parseCents("$1,200")).toBe(120000);
    expect(parseCents("0.99")).toBe(99);
    expect(parseCents(" 7 ")).toBe(700);
  });

  it("rejects things that are not a positive amount", () => {
    for (const bad of ["", "abc", "0", "-5", "1.234", ".", "1e3"]) expect(parseCents(bad)).toBeNull();
  });

  it("formats dollars", () => {
    expect(money(1250)).toBe("$12.50");
    expect(money(100000)).toBe("$1,000.00");
  });
});
