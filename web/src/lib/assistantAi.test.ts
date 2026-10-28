import { describe, expect, it, vi } from "vitest";
import { converse, performAction, prepareAction, type AiEnv, type ModelMsg, type ToolCall } from "./assistantAi";

const now = new Date(2026, 9, 28, 12, 0); // Wednesday
const at = (days: number, h: number) => new Date(2026, 9, 28 + days, h, 0).toISOString();
const local = (days: number, h: number) => `2026-10-${String(28 + days).padStart(2, "0")}T${String(h).padStart(2, "0")}:00`;

function env(over: Partial<AiEnv> = {}): AiEnv {
  return {
    now,
    events: [
      { id: "e1", title: "Study skills workshop", description: "Midterm help", startsAt: at(0, 16), place: "Library", host: "University Library", going: 4 },
      { id: "e2", title: "Open build night", description: "Robots", startsAt: at(1, 19), place: "Engineering lab", host: "Robotics Club", going: 2, mine: "going" },
    ],
    clubs: [
      { id: "c1", name: "Robotics Club", kind: "student", description: "Build robots", people: 12, mine: true, category: "Academic", meeting: "Thursdays", canPost: true, orgKind: "student", trusted: false },
      { id: "c2", name: "Chess Club", kind: "student", description: "Games", people: 8, mine: false, category: "Gaming and hobbies", meeting: "", canPost: false, orgKind: "student", trusted: false },
    ],
    classes: [{ id: "k1", name: "Physics", days: [3], start: "10:00", end: "11:15", place: "Hall B" }],
    reminders: [{ title: "Lab report", date: "2026-10-28", time: "17:00", done: false }],
    groups: [{ id: "g1", name: "Coffee crew", members: ["You", "Maya"] }],
    hangouts: [],
    friends: [{ id: "f1", name: "Maya Lopez", username: "maya" }],
    unread: { messages: 2, notifs: 0 },
    findPeople: async (q) => (q.toLowerCase().startsWith("ma") ? [{ id: "f1", name: "Maya Lopez", username: "maya", relation: "Friend" }] : []),
    addReminder: vi.fn(), createHangout: vi.fn(), createGroup: vi.fn(),
    createEvent: vi.fn(async () => null), sendMessage: vi.fn(async () => null),
    ...over,
  };
}
const call = (name: string, args: unknown, id = "t1"): ToolCall => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
/** A pretend model that says what it is told to say, one reply per call. */
const script = (...replies: ModelMsg[]) => { let i = 0; return async () => replies[Math.min(i++, replies.length - 1)]; };
const say = (content: string): ModelMsg => ({ role: "assistant", content });
const use = (...calls: ToolCall[]): ModelMsg => ({ role: "assistant", content: null, tool_calls: calls });
const user = (content: string): ModelMsg => ({ role: "user", content });

describe("reading tools", () => {
  it("looks events up and feeds them back to the model before answering", async () => {
    const seen: ModelMsg[][] = [];
    const model = async (m: ModelMsg[]) => { seen.push([...m]); return seen.length === 1 ? use(call("search_events", { query: "robot" })) : say("Open build night is tomorrow at 7 PM."); };
    const turn = await converse({ history: [user("any robotics events?")], env: env(), model });
    expect(turn.text).toMatch(/Open build night/);
    const toolMsg = seen[1].find((m) => m.role === "tool")!;
    expect(toolMsg.content).toMatch(/Open build night/);
    expect(toolMsg.content).not.toMatch(/Study skills/);
  });
  it("builds a day from classes, reminders and events the student is going to", async () => {
    let result = "";
    const model = async (m: ModelMsg[]) => { const t = m.find((x) => x.role === "tool"); if (t) { result = t.content!; return say("ok"); } return use(call("my_schedule", { date: "2026-10-28", days: 2 })); };
    const turn = await converse({ history: [user("what is my day like")], env: env(), model });
    const days = JSON.parse(result);
    expect(days[0].items.map((i: { kind: string }) => i.kind)).toEqual(["class", "reminder"]);
    expect(days[1].items[0].title).toBe("Open build night");
    expect(turn.go).toBe("/app/plans");
  });
  it("finds people and says so when nobody matches", async () => {
    const e = env();
    expect(await e.findPeople("maya")).toHaveLength(1);
    let result = "";
    const model = async (m: ModelMsg[]) => { const t = m.find((x) => x.role === "tool"); if (t) { result = t.content!; return say("none"); } return use(call("find_people", { query: "zzzz" })); };
    await converse({ history: [user("find zzzz")], env: e, model });
    expect(result).toMatch(/Nobody/);
  });
  it("survives broken tool arguments", async () => {
    const bad: ToolCall = { id: "x", type: "function", function: { name: "search_events", arguments: "{oops" } };
    const turn = await converse({ history: [user("hi")], env: env(), model: script(use(bad), say("Sorry, let me answer directly.")) });
    expect(turn.text).toMatch(/Sorry/);
  });
});

describe("changes need a confirm", () => {
  it("stops at a confirm card and changes nothing yet", async () => {
    const e = env();
    const turn = await converse({ history: [user("remind me to call mom friday at 5")], env: e, model: script(use(call("create_reminder", { title: "Call mom", date: "2026-10-30", time: "17:00" }))) });
    expect(turn.pending?.tool).toBe("create_reminder");
    expect(turn.pending?.summary).toMatch(/Call mom/);
    expect(e.addReminder).not.toHaveBeenCalled();
  });
  it("does it after the student confirms", async () => {
    const e = env();
    const turn = await converse({ history: [user("x")], env: e, model: script(use(call("create_reminder", { title: "Call mom", date: "2026-10-30" }))) });
    const done = await performAction(e, turn.pending!);
    expect(done.ok).toBe(true);
    expect(e.addReminder).toHaveBeenCalledWith("Call mom", "2026-10-30", undefined);
  });
  it("tells the model what is wrong instead of asking the student to confirm nonsense", async () => {
    const e = env();
    const turn = await converse({ history: [user("x")], env: e, model: script(use(call("create_hangout", { group: "Nope", title: "Lunch", place: "Hall", when: local(1, 12) })), say("Which group do you mean?")) });
    expect(turn.pending).toBeUndefined();
    expect(turn.text).toMatch(/Which group/);
  });
});

describe("checking requests", () => {
  const e = env();
  it("will not post for a club the student cannot post for, or in the past", () => {
    expect(prepareAction(e, "create_event", { club: "Chess Club", title: "Night", place: "Hall", starts_at: local(2, 18) })).toHaveProperty("error");
    expect(prepareAction(e, "create_event", { club: "Robotics", title: "Night", place: "Hall", starts_at: "2026-10-01T18:00" })).toHaveProperty("error");
    const ok = prepareAction(e, "create_event", { club: "robotics", title: "Night", place: "Hall", starts_at: local(2, 18) });
    expect("summary" in ok && ok.summary).toMatch(/coordinator approves/);
  });
  it("only adds friends to a group", () => {
    expect(prepareAction(e, "create_group", { name: "Study", members: ["Stranger"] })).toHaveProperty("error");
    const ok = prepareAction(e, "create_group", { name: "Study", members: ["maya"] });
    expect("args" in ok && ok.args.members).toEqual(["Maya Lopez"]);
  });
  it("sends a message through the app once confirmed", async () => {
    const sendMessage = vi.fn(async () => null);
    const e2 = env({ sendMessage });
    const ok = prepareAction(e2, "send_message", { person_id: "f1", person_name: "Maya", text: "see you at 5" });
    expect("summary" in ok).toBe(true);
    if ("summary" in ok) await performAction(e2, { id: "p", tool: "send_message", summary: ok.summary, args: ok.args, state: "pending" });
    expect(sendMessage).toHaveBeenCalledWith("f1", "see you at 5");
  });
});
