import { useSyncExternalStore } from "react";

/** Opt-in streak and badges. Saved on this device only; nothing is recorded while it is off. */
export type EventType = "post" | "reply" | "group" | "plan" | "rsvpYes" | "rsvpNo" | "checkin";
type Ev = { type: EventType; at: string };
type Saved = { enabled: boolean; events: Ev[]; seen: string[]; checkins: string[] };
type State = Saved & { toast: string[] };

export type Area = "Feed" | "Groups" | "Hangouts" | "Everywhere";
export type BadgeDef = { id: string; name: string; hint: string; area: Area; icon: string; test: (c: Counts) => boolean };
type Counts = Record<EventType, number> & { rainy: boolean };

export const badges: BadgeDef[] = [
  { id: "first-post", name: "First post", hint: "You posted to your campus feed.", area: "Feed", icon: "pen", test: (c) => c.post >= 1 },
  { id: "chatty", name: "Conversation starter", hint: "You replied to 10 posts.", area: "Feed", icon: "messages", test: (c) => c.reply >= 10 },
  { id: "group-starter", name: "Group starter", hint: "You created a group.", area: "Groups", icon: "users", test: (c) => c.group >= 1 },
  { id: "say-yes", name: "Say yes", hint: "You answered Yes to 5 hangouts.", area: "Groups", icon: "checks", test: (c) => c.rsvpYes >= 5 },
  { id: "first-hangout", name: "First hangout", hint: "You planned your first hangout.", area: "Hangouts", icon: "coffee", test: (c) => c.plan >= 1 },
  { id: "regular", name: "Regular", hint: "You checked in to 3 hangouts.", area: "Hangouts", icon: "calendar", test: (c) => c.checkin >= 3 },
  { id: "rainy-day", name: "Rainy day", hint: "You showed up one week and said No to another plan. Both are fine.", area: "Everywhere", icon: "rain", test: (c) => c.rainy },
];

const KEY = "orbit-progress-v1";
const DAY = 86400000;

function load(): State {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return { ...(JSON.parse(s) as Saved), toast: [] };
  } catch { /* storage unavailable */ }
  return { enabled: false, events: [], seen: [], checkins: [], toast: [] };
}

let state: State = load();
const subs = new Set<() => void>();
function set(next: State) {
  state = next;
  try {
    const { toast: _t, ...saved } = state;
    void _t;
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch { /* ignore */ }
  subs.forEach((f) => f());
}

/** Monday of the week containing `d`, as a stable key. */
const weekKey = (d: Date) => {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m.toDateString();
};

function counts(events: Ev[]): Counts {
  const c: Counts = { post: 0, reply: 0, group: 0, plan: 0, rsvpYes: 0, rsvpNo: 0, checkin: 0, rainy: false };
  const weeks = new Map<string, Set<EventType>>();
  for (const e of events) {
    c[e.type]++;
    const k = weekKey(new Date(e.at));
    weeks.set(k, (weeks.get(k) ?? new Set()).add(e.type));
  }
  c.rainy = [...weeks.values()].some((w) => w.has("checkin") && w.has("rsvpNo"));
  return c;
}

export const earnedIds = (s: Pick<State, "events">) => {
  const c = counts(s.events);
  return badges.filter((b) => b.test(c)).map((b) => b.id);
};

/** Consecutive active weeks. This week not being active yet does not break the streak. */
export const streakWeeks = (s: Pick<State, "events">) => {
  const active = new Set(s.events.map((e) => weekKey(new Date(e.at))));
  let w = new Date();
  if (!active.has(weekKey(w))) w = new Date(w.getTime() - 7 * DAY);
  let n = 0;
  while (active.has(weekKey(w))) { n++; w = new Date(w.getTime() - 7 * DAY); }
  return n;
};

export const progress = {
  setEnabled(enabled: boolean) {
    set({ ...state, enabled, seen: enabled ? [...new Set([...state.seen, ...earnedIds(state)])] : state.seen });
  },
  log(type: EventType) {
    if (!state.enabled) return;
    const events = [...state.events, { type, at: new Date().toISOString() }];
    const fresh = earnedIds({ events }).filter((id) => !state.seen.includes(id));
    set({ ...state, events, seen: [...state.seen, ...fresh], toast: [...state.toast, ...fresh] });
  },
  checkIn(hangoutId: string) {
    if (!state.enabled || state.checkins.includes(hangoutId)) return;
    set({ ...state, checkins: [...state.checkins, hangoutId] });
    progress.log("checkin");
  },
  dismissToast() { set({ ...state, toast: state.toast.slice(1) }); },
};

export const useProgress = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
