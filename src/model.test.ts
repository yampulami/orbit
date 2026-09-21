import { describe, it, expect } from "vitest";
import { shares, balances, nextOwner, seed, newSpace } from "./model";
describe("shared living engine", () => {
  it("preserves every cent on uneven splits", () => {
    expect(shares(1001, 4)).toEqual([251, 250, 250, 250]);
    expect(shares(1, 4)).toEqual([1, 0, 0, 0]);
  });
  it("rejects invalid financial inputs", () => {
    expect(() => shares(-1, 4)).toThrow();
    expect(() => shares(1.5, 4)).toThrow();
    expect(() => shares(10, 0)).toThrow();
  });
  it("balances always sum to zero", () => {
    const b = balances([
      { id: "a", title: "Odd bill", payer: "You", cents: 1001 },
      { id: "b", title: "Another bill", payer: "Alex", cents: 753 },
    ]);
    expect(Object.values(b).reduce((a, v) => a + v, 0)).toBe(0);
    expect(b.You).toBe(561);
  });
  it("assigns work to lowest total effort, including completed work", () => {
    const tasks = seed().spaces[0].tasks;
    expect(nextOwner(tasks)).toBe("You");
    expect(
      nextOwner([
        ...tasks,
        { id: "x", title: "More", owner: "You", points: 3, done: true },
      ]),
    ).toBe("Sam");
  });
  it("new spaces keep independent collections", () => {
    const a = newSpace("A"),
      b = newSpace("B");
    a.tasks.push(seed().spaces[0].tasks[0]);
    expect(b.tasks).toHaveLength(0);
    expect(a.id).not.toBe(b.id);
  });
});
