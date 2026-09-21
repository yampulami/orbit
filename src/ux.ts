import type { State, Task, Expense, Grocery, Hangout } from "./model";

export function planTimeline(plans: Hangout[], now: number) {
  const valid = plans.filter((plan) => Number.isFinite(Date.parse(plan.date)));
  return {
    upcoming: valid.filter((p) => Date.parse(p.date) >= now)
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date)),
    past: valid.filter((p) => Date.parse(p.date) < now)
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
  };
}

export function priorityTasks(tasks: Task[]) {
  return tasks.filter((task) => !task.done)
    .sort((a, b) => Number(b.owner === "You") - Number(a.owner === "You"));
}

// Patch editable fields only, including during Undo, preserving current responses.
export function updatePlan(state: State, id: string, patch: Pick<Hangout, "title" | "date">): State {
  return { ...state, hangouts: state.hangouts.map(plan =>
    plan.id === id ? { ...plan, ...patch } : plan) };
}

export function updateExpense(
  state: State,
  spaceId: string,
  expense: Expense,
): State {
  return {
    ...state,
    spaces: state.spaces.map((space) =>
      space.id !== spaceId
        ? space
        : {
            ...space,
            expenses: space.expenses.map((item) =>
              item.id === expense.id ? expense : item,
            ),
          },
    ),
  };
}

export function setGroceryDone(
  state: State,
  spaceId: string,
  id: string,
  done: boolean,
): State {
  return {
    ...state,
    spaces: state.spaces.map((space) =>
      space.id !== spaceId
        ? space
        : {
            ...space,
            groceries: space.groceries.map((item) =>
              item.id === id ? { ...item, done } : item,
            ),
          },
    ),
  };
}

export function groceryGroups(items: Grocery[]) {
  return [...new Set(items.map((item) => item.category))]
    .sort((a, b) => a.localeCompare(b))
    .map((category) => ({
      category,
      items: items.filter((item) => item.category === category),
    }));
}

// Restore only the changed field in the originating space, not an old state snapshot.
export function restoreTaskField(
  state: State,
  spaceId: string,
  taskId: string,
  patch: Partial<Pick<Task, "done" | "owner">>,
): State {
  return {
    ...state,
    spaces: state.spaces.map((space) =>
      space.id !== spaceId || !space.tasks.some((task) => task.id === taskId)
        ? space
        : {
            ...space,
            tasks: space.tasks.map((task) =>
              task.id === taskId ? { ...task, ...patch } : task,
            ),
            history: [
              "Undid change to " +
                space.tasks.find((task) => task.id === taskId)!.title,
              ...space.history,
            ],
          },
    ),
  };
}

// Legacy demo quiet hours use AM/PM; newer edits use 24-hour time.
export function quietTimes(value: string): [string, string] {
  const parts = [...value.matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)?/gi)].map(
    (match) => {
      let hour = Number(match[1]);
      if (match[3])
        hour = (hour % 12) + (match[3].toUpperCase() === "PM" ? 12 : 0);
      return `${String(hour).padStart(2, "0")}:${match[2]}`;
    },
  );
  return [parts[0] ?? "22:00", parts[1] ?? "08:00"];
}
