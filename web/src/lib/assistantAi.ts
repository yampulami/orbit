import { describeWhen } from "./assistant";
import type { ClassSlot } from "./classes";
import { clockLabel, DAY_NAMES, problemWith } from "./classes";

/** The AI side of the assistant. A language model (reached through the `assistant` edge function) reads the conversation and may ask for "tools": things the app does on the
 *  student's behalf. Reading tools run at once. Tools that create or send something do not run: the student gets a confirm card first. Pure apart from the model call
 *  and the actions the app passes in, so it can be tested with a pretend model. */
export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ModelMsg = { role: "user" | "assistant" | "tool"; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string };
export type Person = { id: string; name: string; username: string | null; relation?: string };

export type AiEnv = {
  now: Date;
  events: { id: string; title: string; description: string; startsAt: string; endsAt?: string; place: string; host: string; going: number; mine?: string; orgId?: string }[];
  clubs: { id: string; name: string; kind: string; description: string; people: number; mine: boolean; category: string; meeting: string; canPost: boolean; orgKind: string; trusted: boolean }[];
  classes: ClassSlot[];
  reminders: { id?: string; title: string; date: string; time?: string; done: boolean }[];
  notifications?: { title: string; sub?: string; at: string; unread: boolean }[];
  profile?: { name: string; campus?: string };
  groups: { id: string; name: string; members: string[] }[];
  hangouts: { id: string; groupId: string; title: string; place: string; when: string; canceled?: boolean }[];
  friends: Person[];
  unread: { messages: number; notifs: number };
  findPeople(q: string): Promise<Person[]>;
  findFreeTime?(names: string[], opts: { days: number; duration: number; everyone: boolean; minPeople?: number; mustAttend?: string[]; earliest?: number; latest?: number; skipDays?: number[] }): Promise<{ suggestions: { start: string; end: string; free: number; of: number; missing: string[]; best: boolean; why: string }[]; notSharing: string[]; unknown: string[] }>;
  recentPosts?(): Promise<{ author: string; text: string; at: string; likes: number; comments: number }[]>;
  rsvpEvent?(id: string, answer: "going" | "interested" | null): void;
  requestJoin?(orgId: string, message: string): Promise<string | null>;
  addClass?(c: { name: string; days: number[]; start: string; end: string; place: string }): string | null;
  setReminderDone?(id: string, done: boolean): void;
  removeReminder?(id: string): void;
  cancelHangout?(id: string, canceled: boolean): void;
  rsvpHangout?(id: string, answer: "yes" | "no"): void;
  addReminder(title: string, date: string, time?: string): void;
  createHangout(groupId: string, h: { title: string; place: string; when: string }): void;
  createGroup(name: string, members: string[]): void;
  createEvent(d: { title: string; description: string; place: string; startsAt: string; endsAt?: string; orgId: string; orgName: string; orgKind: string; orgTrusted: boolean }): Promise<string | null>;
  sendMessage(personId: string, text: string): Promise<string | null>;
};

/** A change the assistant wants to make, shown to the student to confirm. */
export type Pending = { id: string; tool: string; summary: string; args: Record<string, unknown>; state: "pending" | "done" | "cancelled" | "failed"; note?: string };
export type AiTurn = { text: string; go?: string; goLabel?: string; pending?: Pending };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + "T12:00").getTime());
const isLocalDateTime = (s: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const named = <T extends { id: string; name: string }>(list: T[], q: string): T | undefined => {
  const n = norm(q);
  if (!n) return undefined;
  return list.find((x) => x.id === q) ?? list.find((x) => norm(x.name) === n) ?? list.find((x) => norm(x.name).includes(n) || n.includes(norm(x.name)));
};

const PAGES: Record<string, { to: string; label: string }> = {
  feed: { to: "/app/feed", label: "Open the feed" }, messages: { to: "/app/messages", label: "Open messages" }, groups: { to: "/app/groups", label: "Open groups" },
  plans: { to: "/app/plans", label: "Open plans" }, campus: { to: "/app/campus", label: "Open Campus" }, map: { to: "/app/map", label: "Open the map" },
  profile: { to: "/app/profile", label: "Open your profile" }, roommates: { to: "/app/roommates", label: "Open roommates" },
};

const fn = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []) => ({ type: "function" as const, function: { name, description, parameters: { type: "object", properties, required } } });
const s = (description: string) => ({ type: "string", description });

export const TOOLS = [
  fn("search_events", "Find upcoming campus events. Use for anything about what is happening, workshops, club events, tonight, this weekend.", { query: s("Words to look for in the title, host, place or description. Optional."), date: s("Only events on this day, YYYY-MM-DD. Optional.") }),
  fn("search_clubs", "Find clubs, offices and student circles on campus by interest or name.", { query: s("Words to look for. Leave empty to list them.") }),
  fn("find_people", "Find students on this campus by name or @username.", { query: s("A name or username.") }, ["query"]),
  fn("my_schedule", "The student's own plan for one or more days: classes, reminders, hangouts and events they are going to.", { date: s("First day, YYYY-MM-DD. Default today."), days: { type: "number", description: "How many days, 1 to 7. Default 1." } }),
  fn("my_groups", "The student's groups with their members and upcoming hangouts."),
  fn("inbox_summary", "How many unread messages and notifications the student has."),
  fn("open_page", "Take the student to a page of the app.", { page: { type: "string", enum: Object.keys(PAGES) } }, ["page"]),
  fn("create_reminder", "Add a one-off reminder for a single date (a task or thing to remember). Not for weekly classes: use add_class for those. The student confirms it first.", { title: s("What to be reminded of."), date: s("YYYY-MM-DD"), time: s("HH:MM, 24 hour. Optional.") }, ["title", "date"]),
  fn("create_hangout", "Plan a hangout inside one of the student's groups. The student confirms it first.", { group: s("The group's name."), title: s("What it is."), place: s("Where."), when: s("YYYY-MM-DDTHH:MM") }, ["group", "title"]),
  fn("create_group", "Make a new group with some of the student's friends. The student confirms it first.", { name: s("The group's name."), members: { type: "array", items: { type: "string" }, description: "Names of friends to add." } }, ["name"]),
  fn("create_event", "Post an event for a club the student runs. The student confirms it first.", { club: s("The club's name."), title: s("Event title."), description: s("A sentence or two."), place: s("Where."), starts_at: s("YYYY-MM-DDTHH:MM"), ends_at: s("YYYY-MM-DDTHH:MM. Optional.") }, ["club", "title"]),
  fn("send_message", "Send a direct message to someone. The student confirms it first. Find the person with find_people first.", { person_id: s("The id from find_people."), person_name: s("Their name."), text: s("The message.") }, ["person_id", "person_name", "text"]),
];
TOOLS.push(
  fn("find_free_time", "Find the best times for the student and some friends to meet (friends who share their free time only). Ranked, with who can make each. Use for \"when are we free\", \"find a time\", \"when can we meet\". With no friends named it gives the student's own free time.", { friends: { type: "array", items: { type: "string" }, description: "Friends' names. Optional." }, duration_minutes: { type: "number", description: "How long the plan lasts, 15 to 480. Default 60." }, days: { type: "number", description: "How many days ahead, 1 to 14. Default 7." }, everyone_must_be_free: { type: "boolean", description: "Default true. False also shows times most people can make." }, minimum_people: { type: "number", description: "At least this many people (counting the student) must be free. Optional." }, must_attend: { type: "array", items: { type: "string" }, description: "Friends who must be able to come. Optional." }, not_before_hour: { type: "number", description: "Earliest hour of the day, 0 to 23. Optional." }, not_after_hour: { type: "number", description: "Latest hour the plan may end, 1 to 24. Optional." }, skip_weekdays: { type: "array", items: { type: "string" }, description: "Weekday names to leave out, like Friday. Optional." } }),
  fn("my_reminders", "All of the student's open reminders, with their ids."),
  fn("my_clubs", "The clubs and circles the student belongs to."),
  fn("notifications", "The student's recent notifications (replies, requests, invites)."),
  fn("recent_posts", "The newest posts on the campus feed, to catch the student up on what people are saying."),
  fn("event_details", "Everything about one event: description, time, place, host, how many are going.", { event_id: s("The id from search_events.") }, ["event_id"]),
  fn("rsvp_event", "Say the student is going, interested, or no longer going to an event. The student confirms it first.", { event_id: s("The id from search_events."), answer: { type: "string", enum: ["going", "interested", "none"] } }, ["event_id", "answer"]),
  fn("join_club", "Ask to join a club or circle the student is not in yet. The student confirms it first.", { club: s("The club's name."), message: s("A short note to the officers. Optional.") }, ["club"]),
  fn("add_class", "Add a class (a course that repeats every week on certain weekdays) to the student's weekly class schedule. Use this whenever the student says class, course or lecture with weekdays and times. Do NOT use create_reminder for this. The student confirms it first.", { name: s("Class name."), days: { type: "array", items: { type: "string" }, description: "Weekday names, like Monday." }, start: s("HH:MM, 24 hour."), end: s("HH:MM, 24 hour."), place: s("Room or building. Optional.") }, ["name", "days", "start", "end"]),
  fn("complete_reminder", "Mark one of the student's reminders as done. The student confirms it first.", { reminder_id: s("The id from my_reminders.") }, ["reminder_id"]),
  fn("delete_reminder", "Delete one of the student's reminders. The student confirms it first.", { reminder_id: s("The id from my_reminders.") }, ["reminder_id"]),
  fn("cancel_hangout", "Cancel a hangout in one of the student's groups. The student confirms it first.", { hangout_id: s("The id of the hangout.") }, ["hangout_id"]),
  fn("rsvp_hangout", "Answer yes or no to a hangout. The student confirms it first.", { hangout_id: s("The id of the hangout."), answer: { type: "string", enum: ["yes", "no"] } }, ["hangout_id", "answer"]),
);
const WRITES = new Set(["create_reminder", "create_hangout", "create_group", "create_event", "send_message", "rsvp_event", "join_club", "add_class", "complete_reminder", "delete_reminder", "cancel_hangout", "rsvp_hangout"]);
export const isWrite = (tool: string) => WRITES.has(tool);

/* ---------- reading ---------- */

type Out = { result: unknown; go?: string; goLabel?: string };

async function read(env: AiEnv, tool: string, a: Record<string, unknown>): Promise<Out> {
  const now = env.now;
  if (tool === "search_events") {
    const q = norm(str(a.query)), date = str(a.date);
    const list = env.events
      .filter((e) => new Date(e.endsAt ?? e.startsAt).getTime() >= now.getTime() - 3600_000)
      .filter((e) => !isYmd(date) || ymd(new Date(e.startsAt)) === date)
      .filter((e) => !q || norm(`${e.title} ${e.host} ${e.place} ${e.description}`).includes(q) || q.split(" ").some((w) => w.length > 2 && norm(`${e.title} ${e.host} ${e.description}`).includes(w)))
      .sort((x, y) => x.startsAt.localeCompare(y.startsAt)).slice(0, 8);
    return { result: list.length ? list.map((e) => ({ id: e.id, title: e.title, when: describeWhen(e.startsAt, now), place: e.place, host: e.host, going: e.going, you: e.mine ?? null, about: e.description.slice(0, 140) })) : "No upcoming events match." };
  }
  if (tool === "search_clubs") {
    const q = norm(str(a.query));
    const list = env.clubs.filter((c) => !q || norm(`${c.name} ${c.description} ${c.category}`).includes(q) || q.split(" ").some((w) => w.length > 2 && norm(`${c.name} ${c.description} ${c.category}`).includes(w))).slice(0, 8);
    return { result: list.length ? list.map((c) => ({ id: c.id, name: c.name, kind: c.kind, about: c.description, category: c.category, meets: c.meeting || null, people: c.people, youAreIn: c.mine })) : "No clubs match.", ...(list.length === 1 ? { go: `/app/campus/clubs/${list[0].id}`, goLabel: `Open ${list[0].name}` } : {}) };
  }
  if (tool === "find_people") {
    const q = str(a.query);
    if (q.length < 2) return { result: "Give at least two letters." };
    const found = await env.findPeople(q);
    return { result: found.length ? found.slice(0, 6).map((p) => ({ id: p.id, name: p.name, username: p.username, relation: p.relation ?? "student" })) : "Nobody on this campus matches." };
  }
  if (tool === "my_schedule") {
    const start = isYmd(str(a.date)) ? new Date(str(a.date) + "T12:00") : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    const days = Math.max(1, Math.min(7, Math.round(Number(a.days) || 1)));
    const out: { date: string; weekday: string; items: { time: string; kind: string; title: string; place?: string }[] }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      const key = ymd(d);
      const items: { time: string; kind: string; title: string; place?: string; sort: string }[] = [];
      for (const c of env.classes) if (c.days.includes(d.getDay())) items.push({ time: `${clockLabel(c.start)} to ${clockLabel(c.end)}`, sort: c.start, kind: "class", title: c.name, place: c.place });
      for (const r of env.reminders) if (!r.done && r.date === key) items.push({ time: r.time ? clockLabel(r.time) : "any time", sort: r.time ?? "09:00", kind: "reminder", title: r.title });
      for (const h of env.hangouts) if (!h.canceled && ymd(new Date(h.when)) === key) items.push({ time: new Date(h.when).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), sort: new Date(h.when).toTimeString().slice(0, 5), kind: "hangout", title: h.title, place: h.place });
      for (const e of env.events) if (e.mine === "going" && ymd(new Date(e.startsAt)) === key) items.push({ time: new Date(e.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), sort: new Date(e.startsAt).toTimeString().slice(0, 5), kind: "event", title: e.title, place: e.place });
      items.sort((x, y) => x.sort.localeCompare(y.sort));
      out.push({ date: key, weekday: d.toLocaleDateString(undefined, { weekday: "long" }), items: items.map(({ sort: _s, ...rest }) => rest) });
    }
    return { result: out, go: "/app/plans", goLabel: "Open plans" };
  }
  if (tool === "my_groups") {
    return { result: env.groups.length ? env.groups.map((g) => ({ name: g.name, members: g.members, upcoming: env.hangouts.filter((h) => h.groupId === g.id && !h.canceled && new Date(h.when).getTime() > now.getTime()).map((h) => ({ id: h.id, what: `${h.title} ${describeWhen(h.when, now)} at ${h.place}` })) })) : "The student is not in any groups yet.", go: "/app/groups", goLabel: "Open groups" };
  }
  if (tool === "inbox_summary") return { result: { unreadMessages: env.unread.messages, unreadNotifications: env.unread.notifs }, ...(env.unread.messages > 0 ? { go: "/app/messages", goLabel: "Open messages" } : {}) };
  if (tool === "open_page") {
    const p = PAGES[str(a.page)];
    return p ? { result: `Ready: ${p.label}.`, go: p.to, goLabel: p.label } : { result: "That page does not exist." };
  }
  if (tool === "my_reminders") {
    const open = env.reminders.filter((r) => !r.done).sort((x, y) => `${x.date}${x.time ?? ""}`.localeCompare(`${y.date}${y.time ?? ""}`)).slice(0, 20);
    return { result: open.length ? open.map((r) => ({ id: r.id, title: r.title, date: r.date, time: r.time ?? null })) : "No open reminders.", go: "/app/plans", goLabel: "Open plans" };
  }
  if (tool === "my_clubs") {
    const mine = env.clubs.filter((c) => c.mine);
    return { result: mine.length ? mine.map((c) => ({ id: c.id, name: c.name, kind: c.kind, meets: c.meeting || null })) : "The student is not in any clubs yet." };
  }
  if (tool === "notifications") {
    const list = (env.notifications ?? []).slice(0, 10);
    return { result: list.length ? list.map((n) => ({ what: n.title, detail: n.sub ?? null, when: describeWhen(n.at, now), unread: n.unread })) : "No notifications." };
  }
  if (tool === "recent_posts") {
    const list = env.recentPosts ? (await env.recentPosts()).slice(0, 8) : [];
    return { result: list.length ? list.map((p) => ({ by: p.author, text: p.text.slice(0, 220), when: describeWhen(p.at, now), likes: p.likes, comments: p.comments })) : "Nothing on the feed yet.", go: "/app/feed", goLabel: "Open the feed" };
  }
  if (tool === "find_free_time") {
    if (!env.findFreeTime) return { result: "Finding free time is not available here." };
    const names = Array.isArray(a.friends) ? a.friends.map(str).filter(Boolean).slice(0, 6) : [];
    const days = Math.max(1, Math.min(14, Math.round(Number(a.days) || 7)));
    const duration = Math.max(15, Math.min(480, Math.round(Number(a.duration_minutes) || 60)));
    const hour = (v: unknown, lo: number, hi: number) => (Number.isFinite(Number(v)) && v !== undefined && v !== null ? Math.max(lo, Math.min(hi, Math.round(Number(v)))) * 60 : undefined);
    const skipDays = (Array.isArray(a.skip_weekdays) ? a.skip_weekdays : []).map((d) => DAY_NAMES.findIndex((n) => n.toLowerCase().startsWith(str(d).toLowerCase().slice(0, 3)))).filter((i) => i >= 0);
    const out = await env.findFreeTime(names, {
      days, duration, everyone: a.everyone_must_be_free !== false,
      minPeople: Number.isFinite(Number(a.minimum_people)) && Number(a.minimum_people) > 0 ? Math.round(Number(a.minimum_people)) : undefined,
      mustAttend: Array.isArray(a.must_attend) ? a.must_attend.map(str).filter(Boolean) : undefined,
      earliest: hour(a.not_before_hour, 0, 23), latest: hour(a.not_after_hour, 1, 24), skipDays,
    });
    const suggestions = out.suggestions.slice(0, 6).map((s) => ({ start: s.start, when: describeWhen(s.start, now), minutes: duration, freeCount: `${s.free} of ${s.of}`, cantMake: s.missing, bestMatch: s.best, why: s.why }));
    return { result: { suggestions: suggestions.length ? suggestions : `Nothing of ${duration} minutes works in the next ${days} days.`, notSharingTheirFreeTime: out.notSharing, notFriends: out.unknown }, go: "/app/plans", goLabel: "Open plans" };
  }
  if (tool === "event_details") {
    const e = env.events.find((x) => x.id === str(a.event_id));
    return { result: e ? { id: e.id, title: e.title, about: e.description, when: describeWhen(e.startsAt, now), place: e.place, host: e.host, going: e.going, you: e.mine ?? null } : "No event with that id." };
  }
  return { result: "Unknown tool." };
}

/* ---------- changing things: checked now, done only after the student confirms ---------- */

/** Check a requested change and say in plain words what it will do, or what is wrong with it. */
export function prepareAction(env: AiEnv, tool: string, a: Record<string, unknown>): { summary: string; args: Record<string, unknown> } | { error: string } {
  const now = env.now;
  if (tool === "create_reminder") {
    const title = str(a.title).slice(0, 120), date = str(a.date), time = str(a.time);
    if (!title) return { error: "A reminder needs a title." };
    if (!isYmd(date)) return { error: "Give the date as YYYY-MM-DD." };
    if (time && !/^\d{2}:\d{2}$/.test(time)) return { error: "Give the time as HH:MM." };
    return { summary: `Remind you: "${title}" on ${new Date(date + "T12:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}${time ? ` at ${clockLabel(time)}` : ""}.`, args: { title, date, time: time || undefined } };
  }
  if (tool === "create_hangout") {
    const g = named(env.groups, str(a.group));
    const title = str(a.title).slice(0, 80), place = str(a.place).slice(0, 80), when = str(a.when);
    if (!g) return { error: `No group called "${str(a.group)}". Their groups: ${env.groups.map((x) => x.name).join(", ") || "none"}.` };
    if (!title || !place) return { error: "Ask the student where the hangout is. It needs a title and a place." };
    if (!isLocalDateTime(when)) return { error: "Ask the student when it is, then give the time as YYYY-MM-DDTHH:MM." };
    if (new Date(when).getTime() < now.getTime() - 60_000) return { error: "That time has already passed." };
    return { summary: `Plan "${title}" for ${g.name}, ${describeWhen(new Date(when).toISOString(), now)} at ${place}.`, args: { groupId: g.id, title, place, when } };
  }
  if (tool === "create_group") {
    const name = str(a.name).slice(0, 40);
    if (!name) return { error: "A group needs a name." };
    const want = Array.isArray(a.members) ? a.members.map(str).filter(Boolean).slice(0, 12) : [];
    const people: string[] = [];
    for (const m of want) {
      const f = env.friends.find((x) => norm(x.name) === norm(m) || (x.username ?? "").toLowerCase() === m.toLowerCase().replace(/^@/, "")) ?? env.friends.find((x) => norm(x.name).includes(norm(m)));
      if (!f) return { error: `"${m}" is not one of their friends yet, so they cannot be added. Friends: ${env.friends.map((x) => x.name).join(", ") || "none"}.` };
      people.push(f.name);
    }
    return { summary: `Start the group "${name}"${people.length ? ` and message ${people.join(", ")} a link to join` : ""}.`, args: { name, members: people } };
  }
  if (tool === "create_event") {
    const c = named(env.clubs, str(a.club));
    const title = str(a.title).slice(0, 120), place = str(a.place).slice(0, 120), description = str(a.description).slice(0, 600);
    const startsAt = str(a.starts_at), endsAt = str(a.ends_at);
    if (!c) return { error: `No club called "${str(a.club)}".` };
    if (!c.canPost) return { error: `They cannot post events for ${c.name}. Only people with the events permission can.` };
    if (!title || !place) return { error: "Ask the student where the event is. It needs a title and a place." };
    if (!isLocalDateTime(startsAt)) return { error: "Ask the student when it starts, then give the start as YYYY-MM-DDTHH:MM." };
    if (endsAt && (!isLocalDateTime(endsAt) || new Date(endsAt) <= new Date(startsAt))) return { error: "The end must come after the start." };
    if (new Date(startsAt).getTime() < now.getTime() - 60_000) return { error: "That time has already passed." };
    return { summary: `Post "${title}" for ${c.name}, ${describeWhen(new Date(startsAt).toISOString(), now)} at ${place}${c.trusted ? "." : ". A coordinator approves it before everyone sees it."}`, args: { orgId: c.id, orgName: c.name, orgKind: c.orgKind, orgTrusted: c.trusted, title, place, description, startsAt, endsAt: endsAt || undefined } };
  }
  if (tool === "send_message") {
    const id = str(a.person_id), name = str(a.person_name), text = str(a.text).slice(0, 1000);
    if (!id || !name || !text) return { error: "Need who to message and what to say." };
    return { summary: `Message ${name}: "${text.length > 120 ? text.slice(0, 119) + "…" : text}"`, args: { personId: id, name, text } };
  }
  if (tool === "rsvp_event") {
    const e = env.events.find((x) => x.id === str(a.event_id));
    const ans = str(a.answer);
    if (!e) return { error: "No event with that id. Search for it first." };
    if (!["going", "interested", "none"].includes(ans)) return { error: "The answer is going, interested or none." };
    return { summary: ans === "none" ? `Take back your answer for "${e.title}".` : `Mark you as ${ans} for "${e.title}", ${describeWhen(e.startsAt, now)}.`, args: { eventId: e.id, answer: ans } };
  }
  if (tool === "join_club") {
    const c = named(env.clubs, str(a.club));
    if (!c) return { error: `No club called "${str(a.club)}".` };
    if (c.mine) return { error: `The student is already in ${c.name}.` };
    return { summary: `Ask to join ${c.name}.`, args: { orgId: c.id, name: c.name, message: str(a.message).slice(0, 200) } };
  }
  if (tool === "add_class") {
    const name = str(a.name).slice(0, 60), start = str(a.start), end = str(a.end), place = str(a.place).slice(0, 60);
    const days = (Array.isArray(a.days) ? a.days : []).map((d) => DAY_NAMES.findIndex((n) => n.toLowerCase().startsWith(str(d).toLowerCase().slice(0, 3)))).filter((i, k, all) => i >= 0 && all.indexOf(i) === k);
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return { error: "Give the times as HH:MM." };
    const bad = problemWith({ name, days, start, end });
    if (bad) return { error: bad };
    return { summary: `Add "${name}" on ${days.map((d) => DAY_NAMES[d].slice(0, 3)).join(", ")}, ${clockLabel(start)} to ${clockLabel(end)}${place ? ` in ${place}` : ""}.`, args: { name, days, start, end, place } };
  }
  if (tool === "complete_reminder" || tool === "delete_reminder") {
    const r = env.reminders.find((x) => x.id && x.id === str(a.reminder_id));
    if (!r) return { error: "No reminder with that id. Use my_reminders first." };
    return { summary: tool === "complete_reminder" ? `Mark "${r.title}" as done.` : `Delete the reminder "${r.title}".`, args: { id: r.id, title: r.title } };
  }
  if (tool === "cancel_hangout" || tool === "rsvp_hangout") {
    const h = env.hangouts.find((x) => x.id === str(a.hangout_id));
    if (!h) return { error: "No hangout with that id. Use my_groups first." };
    if (tool === "cancel_hangout") return { summary: `Cancel "${h.title}".`, args: { id: h.id } };
    const ans = str(a.answer);
    if (ans !== "yes" && ans !== "no") return { error: "The answer is yes or no." };
    return { summary: `Answer ${ans} to "${h.title}".`, args: { id: h.id, answer: ans } };
  }
  return { error: "Unknown action." };
}

/** Do a confirmed change. Resolves to a short sentence for the chat, or an error message. */
export async function performAction(env: AiEnv, p: Pending): Promise<{ ok: boolean; note: string; go?: string; goLabel?: string }> {
  const a = p.args;
  try {
    if (p.tool === "create_reminder") { env.addReminder(String(a.title), String(a.date), a.time ? String(a.time) : undefined); return { ok: true, note: "Reminder added.", go: "/app/plans", goLabel: "Open plans" }; }
    if (p.tool === "create_hangout") { env.createHangout(String(a.groupId), { title: String(a.title), place: String(a.place), when: String(a.when) }); return { ok: true, note: "Hangout planned. Your group can answer it now.", go: "/app/groups", goLabel: "Open groups" }; }
    if (p.tool === "create_group") { env.createGroup(String(a.name), (a.members as string[]) ?? []); return { ok: true, note: "Group made.", go: "/app/groups", goLabel: "Open groups" }; }
    if (p.tool === "create_event") {
      const err = await env.createEvent({ title: String(a.title), description: String(a.description ?? ""), place: String(a.place), startsAt: new Date(String(a.startsAt)).toISOString(), endsAt: a.endsAt ? new Date(String(a.endsAt)).toISOString() : undefined, orgId: String(a.orgId), orgName: String(a.orgName), orgKind: String(a.orgKind), orgTrusted: !!a.orgTrusted });
      return err ? { ok: false, note: err } : { ok: true, note: a.orgTrusted ? "Event posted." : "Event sent for approval.", go: `/app/campus/clubs/${a.orgId}`, goLabel: `Open ${a.orgName}` };
    }
    if (p.tool === "send_message") {
      const err = await env.sendMessage(String(a.personId), String(a.text));
      return err ? { ok: false, note: err } : { ok: true, note: `Sent to ${a.name}.`, go: "/app/messages", goLabel: "Open messages" };
    }
    if (p.tool === "rsvp_event" && env.rsvpEvent) { env.rsvpEvent(String(a.eventId), a.answer === "none" ? null : (a.answer as "going" | "interested")); return { ok: true, note: a.answer === "none" ? "Answer removed." : `Marked ${a.answer}.`, go: "/app/campus", goLabel: "Open Campus" }; }
    if (p.tool === "join_club" && env.requestJoin) { const err = await env.requestJoin(String(a.orgId), String(a.message ?? "")); return err ? { ok: false, note: err } : { ok: true, note: `Asked to join ${a.name}.`, go: `/app/campus/clubs/${a.orgId}`, goLabel: `Open ${a.name}` }; }
    if (p.tool === "add_class" && env.addClass) { const err = env.addClass({ name: String(a.name), days: a.days as number[], start: String(a.start), end: String(a.end), place: String(a.place ?? "") }); return err ? { ok: false, note: err } : { ok: true, note: "Class added.", go: "/app/plans", goLabel: "Open plans" }; }
    if (p.tool === "complete_reminder" && env.setReminderDone) { env.setReminderDone(String(a.id), true); return { ok: true, note: "Marked done." }; }
    if (p.tool === "delete_reminder" && env.removeReminder) { env.removeReminder(String(a.id)); return { ok: true, note: "Reminder deleted." }; }
    if (p.tool === "cancel_hangout" && env.cancelHangout) { env.cancelHangout(String(a.id), true); return { ok: true, note: "Hangout canceled.", go: "/app/groups", goLabel: "Open groups" }; }
    if (p.tool === "rsvp_hangout" && env.rsvpHangout) { env.rsvpHangout(String(a.id), a.answer as "yes" | "no"); return { ok: true, note: `Answered ${a.answer}.`, go: "/app/groups", goLabel: "Open groups" }; }
  } catch { return { ok: false, note: "That did not work. Try again in a moment." }; }
  return { ok: false, note: "I do not know how to do that." };
}

/* ---------- the conversation ---------- */

const LABELS: Record<string, string> = { find_free_time: "Comparing free time", my_reminders: "Checking your reminders", my_clubs: "Looking at your clubs", notifications: "Reading your notifications", recent_posts: "Reading the feed", event_details: "Looking at that event", search_events: "Checking events", search_clubs: "Looking at clubs", find_people: "Finding people", my_schedule: "Checking your schedule", my_groups: "Looking at your groups", inbox_summary: "Checking your inbox", open_page: "Getting that ready" };

export async function converse(opts: { history: ModelMsg[]; env: AiEnv; model: (messages: ModelMsg[]) => Promise<ModelMsg>; onStep?: (label: string) => void }): Promise<AiTurn> {
  const { env, model, onStep } = opts;
  const msgs: ModelMsg[] = [...opts.history];
  let go: string | undefined, goLabel: string | undefined;
  for (let round = 0; round < 5; round++) {
    const reply = await model(msgs);
    const calls = reply.tool_calls ?? [];
    if (calls.length === 0) return { text: (reply.content ?? "").trim(), go, goLabel };
    msgs.push({ role: "assistant", content: reply.content ?? null, tool_calls: calls });
    for (const c of calls) {
      const name = c.function.name;
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(c.function.arguments || "{}"); } catch { msgs.push({ role: "tool", tool_call_id: c.id, content: "The arguments were not valid JSON. Try again." }); continue; }
      if (isWrite(name)) {
        const prepared = prepareAction(env, name, args);
        if ("error" in prepared) { msgs.push({ role: "tool", tool_call_id: c.id, content: prepared.error }); continue; }
        return { text: (reply.content ?? "").trim() || "Here is what I will do. Confirm it and I will go ahead.", go, goLabel, pending: { id: crypto.randomUUID(), tool: name, summary: prepared.summary, args: prepared.args, state: "pending" } };
      }
      onStep?.(LABELS[name] ?? "Working on it");
      const out = await read(env, name, args).catch(() => ({ result: "That lookup failed." } as Out));
      if (out.go) { go = out.go; goLabel = out.goLabel; }
      msgs.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(out.result).slice(0, 5000) });
    }
  }
  return { text: "That took too many steps. Try asking for one thing at a time.", go, goLabel };
}
