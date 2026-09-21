import { expect, test } from "vitest";
import { quietTimes, restoreTaskField } from "./ux";
import { seed, newSpace, balances, shares } from "./model";
import { updateExpense, setGroceryDone, groceryGroups } from "./ux";
import { planTimeline, priorityTasks, updatePlan } from "./ux";

test("plan rescheduling and undo preserve later responses and unrelated state", () => {
  const state = seed();
  const original = state.hangouts[0];
  const patch = { title: "Rescheduled", date: "2027-01-01T12:00" };
  const changed = updatePlan(state, original.id, patch);
  expect(changed.hangouts[0].votes).toEqual(original.votes);
  expect(planTimeline(changed.hangouts, Date.parse("2026-12-01T12:00")).upcoming[0].id).toBe(original.id);
  changed.hangouts[0] = { ...changed.hangouts[0], votes: ["You"] };
  changed.name = "Updated profile";
  const undone = updatePlan(changed, original.id, { title: original.title, date: original.date });
  expect(undone.hangouts[0]).toEqual({ ...original, votes: ["You"] });
  expect(undone.name).toBe("Updated profile");
  expect(undone.hangouts[1]).toBe(state.hangouts[1]);
  expect(state.hangouts[0]).toBe(original);
});

test("timeline handles start boundary, offsets, ordering, and does not mutate plans", () => {
  const now = Date.parse("2026-09-17T12:00:00Z");
  const plans = [
    { id: "later", title: "Later", date: "2026-09-18T12:00:00Z", votes: [] },
    { id: "old", title: "Old", date: "2026-09-15T12:00:00Z", votes: [] },
    { id: "now", title: "Now", date: "2026-09-17T08:00:00-04:00", votes: ["You"] },
    { id: "recent", title: "Recent", date: "2026-09-17T11:59:00Z", votes: [] },
  ];
  const original = structuredClone(plans);
  expect(planTimeline(plans, now).upcoming.map(p => p.id)).toEqual(["now", "later"]);
  expect(planTimeline(plans, now).past.map(p => p.id)).toEqual(["recent", "old"]);
  expect(planTimeline(plans, now + 1).past[0].id).toBe("now");
  expect(plans).toEqual(original);
  expect(planTimeline([], now)).toEqual({ upcoming: [], past: [] });
});

test("home prioritizes your pending chores while preserving order and input", () => {
  const tasks = [
    { id: "a", title: "Shared", owner: "Alex", done: false, points: 1 },
    { id: "b", title: "Done", owner: "You", done: true, points: 1 },
    { id: "c", title: "Mine", owner: "You", done: false, points: 1 },
    { id: "d", title: "Shared two", owner: "Sam", done: false, points: 1 },
  ];
  expect(priorityTasks(tasks).map(t => t.id)).toEqual(["c", "a", "d"]);
  expect(tasks.map(t => t.id)).toEqual(["a", "b", "c", "d"]);
});

test("expense correction replaces only the original expense and supports exact undo", () => {
  const state = seed();
  const space = state.spaces[0];
  const original = space.expenses[0];
  state.spaces.push(newSpace("Other", "other"));
  state.active = "other";
  const changed = updateExpense(state, space.id, {
    ...original,
    cents: 1001,
    payer: "Alex",
  });
  expect(changed.spaces[0].expenses).toHaveLength(space.expenses.length);
  expect(changed.spaces[1]).toBe(state.spaces[1]);
  expect(changed.active).toBe("other");
  expect(shares(1001, 4)).toEqual([251, 250, 250, 250]);
  expect(balances([{ ...original, cents: 1001, payer: "Alex" }]).You).toBe(
    -251,
  );
  expect(updateExpense(changed, space.id, original).spaces[0].expenses).toEqual(
    space.expenses,
  );
  expect(space.expenses[0]).toBe(original);
});

test("grocery undo preserves unrelated edits and groups categories without dropping items", () => {
  const state = seed();
  const space = state.spaces[0];
  const grocery = space.groceries[0];
  const changed = setGroceryDone(state, space.id, grocery.id, true);
  changed.name = "Updated name";
  const undone = setGroceryDone(changed, space.id, grocery.id, grocery.done);
  expect(undone.name).toBe("Updated name");
  expect(undone.spaces[0].groceries).toEqual(space.groceries);
  const groups = groceryGroups(space.groceries);
  expect(
    groups
      .flatMap((group) => group.items)
      .map((item) => item.id)
      .sort(),
  ).toEqual(space.groceries.map((item) => item.id).sort());
  expect(
    groups.every((group) =>
      group.items.every((item) => item.category === group.category),
    ),
  ).toBe(true);
});

test("undo targets the original task without overwriting other edits or spaces", () => {
  const state = seed();
  const original = state.spaces[0];
  const task = original.tasks[0];
  task.done = true;
  task.owner = "Alex";
  state.spaces.push(newSpace("Another room", "other"));
  state.active = "other";
  const result = restoreTaskField(state, original.id, task.id, { done: false });
  expect(result.active).toBe("other");
  expect(result.spaces[0].tasks[0].done).toBe(false);
  expect(result.spaces[0].tasks[0].owner).toBe("Alex");
  expect(result.spaces[0].expenses).toEqual(original.expenses);
  expect(result.spaces[1]).toBe(state.spaces[1]);
  expect(task.done).toBe(true);
});
test("quiet hours preserve legacy evening times and midnight/noon", () => {
  expect(quietTimes("10:00 PM – 8:00 AM")).toEqual(["22:00", "08:00"]);
  expect(quietTimes("12:00 AM – 12:30 PM")).toEqual(["00:00", "12:30"]);
});
test("quiet hours round-trip 24-hour edits", () => {
  expect(quietTimes("23:15 – 07:45")).toEqual(["23:15", "07:45"]);
});
