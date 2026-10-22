import { describe, expect, it } from "vitest";
import { buildSpace, type RawHousehold } from "./roommatesDb";

const ME = "11111111-aaaa", MAYA = "22222222-bbbb", JO = "33333333-cccc", JO2 = "44444444-dddd";
const raw: RawHousehold = {
  me: ME, groupId: "g1", name: "Hamilton 3F",
  members: [MAYA, ME],
  tasks: [{ id: "t1", title: "Trash", assignee: MAYA, points: 1, done: false, done_at: null, due_on: "2026-10-25", created_at: "2026-10-21T10:00:00Z" }],
  groceries: [{ id: "g1", name: "Oat milk", category: "Dairy", bought: true }],
  expenses: [{ id: "e1", item: "Internet", cents: 6000, paid_by: ME, split: [ME, MAYA], created_at: "2026-10-21T11:00:00Z" }],
  notes: [{ id: "n1", title: "Quiet hours", body: "After 10pm" }],
  payments: [],
  names: { [ME]: "Taylor", [MAYA]: "Maya" },
};

describe("buildSpace", () => {
  it("lists you first and shows people by name", () => {
    const { space } = buildSpace(raw);
    expect(space.members).toEqual(["You", "Maya"]);
    expect(space.tasks[0]).toMatchObject({ assignee: "Maya", points: 1, due: "2026-10-25", done: false });
    expect(space.expenses[0]).toMatchObject({ paidBy: "You", split: ["You", "Maya"], cents: 6000 });
    expect(space.groceries[0].bought).toBe(true);
    expect(space.notes[0].title).toBe("Quiet hours");
    expect(space.groupId).toBe("g1");
  });

  it("remembers which name is which person, so changes can be saved to the right user", () => {
    const { ids } = buildSpace(raw);
    expect(ids).toMatchObject({ You: ME, Maya: MAYA });
  });

  it("tells two roommates with the same name apart", () => {
    const { space, ids } = buildSpace({ ...raw, members: [ME, JO, JO2], names: { ...raw.names, [JO]: "Jo", [JO2]: "Jo" }, tasks: [] });
    expect(space.members).toEqual(["You", "Jo 3333", "Jo 4444"]);
    expect(ids["Jo 4444"]).toBe(JO2);
  });

  it("copes with a chore whose person left and an unknown effort value", () => {
    const { space } = buildSpace({ ...raw, tasks: [{ ...raw.tasks[0], assignee: null, points: 4 }] });
    expect(space.tasks[0].assignee).toBe("Someone");
    expect(space.tasks[0].points).toBe(2);
  });
});
