import { describe, expect, it } from "vitest";
import { netBalances, settlements, type Expense, type Payment } from "./roommates";
import { buildSpace, type RawHousehold } from "./roommatesDb";

const members = ["You", "Maya"];
const dinner: Expense = { id: "e1", item: "Dinner", cents: 3000, paidBy: "Maya", split: members, at: "2026-10-22T10:00:00Z" };
const pay = (from: string, to: string, cents: number): Payment => ({ id: `${from}-${to}-${cents}`, from, to, cents, at: "2026-10-22T12:00:00Z" });

describe("payments count against what is owed", () => {
  it("clears the debt when the full amount is paid", () => {
    const net = netBalances(members, [dinner], [pay("You", "Maya", 1500)]);
    expect(net).toEqual({ You: 0, Maya: 0 });
    expect(settlements(net)).toEqual([]);
  });

  it("leaves what is still owed after a part payment", () => {
    const net = netBalances(members, [dinner], [pay("You", "Maya", 500)]);
    expect(net).toEqual({ You: -1000, Maya: 1000 });
    expect(settlements(net)).toEqual([{ from: "You", to: "Maya", cents: 1000 }]);
  });

  it("flips the debt if someone overpays", () => {
    const net = netBalances(members, [dinner], [pay("You", "Maya", 2000)]);
    expect(net).toEqual({ You: 500, Maya: -500 });
    expect(settlements(net)).toEqual([{ from: "Maya", to: "You", cents: 500 }]);
  });

  it("works with no payments at all, as before", () => {
    expect(netBalances(members, [dinner])).toEqual(netBalances(members, [dinner], []));
  });

  it("keeps everyone's balances adding up to zero", () => {
    const three = ["You", "Maya", "Jo"];
    const e: Expense = { ...dinner, cents: 3100, split: three };
    const net = netBalances(three, [e], [pay("Jo", "Maya", 700), pay("You", "Maya", 100)]);
    expect(Object.values(net).reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe("payments from the database", () => {
  const ME = "11111111-aaaa", MAYA = "22222222-bbbb";
  const raw: RawHousehold = {
    me: ME, groupId: "g1", name: "House", members: [ME, MAYA], tasks: [], groceries: [], expenses: [], notes: [],
    payments: [{ id: "p1", from_user: ME, to_user: MAYA, cents: 1500, created_at: "2026-10-22T12:00:00Z" }],
    names: { [ME]: "Taylor", [MAYA]: "Maya" },
  };
  it("shows who paid whom, by name", () => {
    expect(buildSpace(raw).space.payments).toEqual([{ id: "p1", from: "You", to: "Maya", cents: 1500, at: "2026-10-22T12:00:00Z" }]);
  });
  it("shows a payment from someone who has since left as Someone", () => {
    expect(buildSpace({ ...raw, payments: [{ ...raw.payments[0], from_user: null }] }).space.payments[0].from).toBe("Someone");
  });
});
