export const members = ["You", "Alex", "Jordan", "Sam"];
export type Task = {
  id: string;
  title: string;
  owner: string;
  points: number;
  done: boolean;
};
export type Grocery = {
  id: string;
  title: string;
  category: string;
  done: boolean;
};
export type Expense = {
  id: string;
  title: string;
  cents: number;
  payer: string;
};
export type Hangout = {
  id: string;
  title: string;
  date: string;
  votes: string[];
};
export type Space = {
  id: string;
  name: string;
  tasks: Task[];
  groceries: Grocery[];
  expenses: Expense[];
  history: string[];
  maintenance: { id: string; title: string; done: boolean }[];
  quiet: string;
};
export type State = {
  version: 1;
  name: string;
  email: string;
  active: string;
  spaces: Space[];
  hangouts: Hangout[];
  free: boolean;
  joined: string[];
  rsvps: string[];
};
export const uid = () => crypto.randomUUID();
export function shares(cents: number, count: number) {
  if (
    !Number.isSafeInteger(cents) ||
    cents < 0 ||
    !Number.isInteger(count) ||
    count < 1
  )
    throw new Error("Invalid split");
  return Array.from(
    { length: count },
    (_, i) => Math.floor(cents / count) + (i < cents % count ? 1 : 0),
  );
}
export function balances(expenses: Expense[]) {
  const result = Object.fromEntries(members.map((m) => [m, 0]));
  for (const e of expenses) {
    if (!members.includes(e.payer)) continue;
    result[e.payer] += e.cents;
    shares(e.cents, members.length).forEach(
      (n, i) => (result[members[i]] -= n),
    );
  }
  return result;
}
export function nextOwner(tasks: Task[]) {
  const score = Object.fromEntries(members.map((m) => [m, 0]));
  tasks.forEach((t) => (score[t.owner] += t.points));
  return members.reduce((a, b) => (score[a] <= score[b] ? a : b));
}
export function newSpace(name: string, id: string = uid()): Space {
  return {
    id,
    name,
    tasks: [],
    groceries: [],
    expenses: [],
    history: [],
    maintenance: [],
    quiet: "10:00 PM – 8:00 AM",
  };
}
export function seed(): State {
  return {
    version: 1,
    name: "Jamie",
    email: "",
    active: "maple",
    spaces: [
      {
        id: "maple",
        name: "Maple Hall · 204",
        tasks: [
          {
            id: "t1",
            title: "Take out the recycling",
            owner: "You",
            points: 2,
            done: false,
          },
          {
            id: "t2",
            title: "Wipe down the kitchen",
            owner: "Alex",
            points: 3,
            done: false,
          },
          {
            id: "t3",
            title: "Vacuum the common area",
            owner: "Jordan",
            points: 4,
            done: false,
          },
          {
            id: "t4",
            title: "Restock the bathroom",
            owner: "Sam",
            points: 2,
            done: true,
          },
        ],
        groceries: [
          {
            id: "g1",
            title: "Oat milk",
            category: "Dairy & alternatives",
            done: false,
          },
          { id: "g2", title: "Bananas", category: "Produce", done: false },
          { id: "g3", title: "Dish soap", category: "Household", done: false },
        ],
        expenses: [
          { id: "e1", title: "Weekly groceries", cents: 6840, payer: "You" },
          {
            id: "e2",
            title: "Internet · September",
            cents: 4000,
            payer: "Alex",
          },
        ],
        history: ["Sam completed Restock the bathroom"],
        maintenance: [],
        quiet: "10:00 PM – 8:00 AM",
      },
    ],
    hangouts: [
      {
        id: "h1",
        title: "Coffee & a study session",
        date: "2026-09-16T16:00",
        votes: ["Alex", "Sam"],
      },
      {
        id: "h2",
        title: "Friday movie night",
        date: "2026-09-18T19:00",
        votes: ["Jordan", "Alex", "Sam"],
      },
    ],
    free: false,
    joined: ["Outdoor Club"],
    rsvps: [],
  };
}
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
