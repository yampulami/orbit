import { useSyncExternalStore } from "react";
import { progress } from "./progress";

/** Friend groups, group chat and hangout RSVPs. Saved on this device only until groups sync to the server. */
export const YOU = "You";

export type Rsvp = "yes" | "no";
export type Msg = { id: string; author: string; text?: string; hangoutId?: string; at: string };
export type Group = { id: string; name: string; members: string[]; messages: Msg[] };
export type Hangout = { id: string; groupId: string; title: string; place: string; when: string; by: string; rsvps: Record<string, Rsvp>; canceled?: boolean; /** Length in minutes, for the schedule board. Defaults to 90. */ len?: number };
type State = { groups: Group[]; hangouts: Hangout[] };

const KEY = "orbit-hangouts-v3";
const ago = (m: number) => new Date(Date.now() - m * 60000).toISOString();

function seed(): State {
  /** A moment `d` days from today at hh:mm, so the demo week is always full. */
  const at = (d: number, hh: number, mm = 0) => { const t = new Date(); t.setDate(t.getDate() + d); t.setHours(hh, mm, 0, 0); return t.toISOString(); };
  return {
    groups: [
      {
        id: "g1", name: "Coffee crew", members: [YOU, "Maya", "Jordan", "Priya"],
        messages: [
          { id: "m1", author: "Maya", text: "Anyone free this weekend? I need caffeine and a break from the library.", at: ago(120) },
          { id: "m2", author: "Jordan", text: "Yes! Let’s do coffee somewhere on campus.", at: ago(110) },
          { id: "m3", author: "Maya", hangoutId: "h1", at: ago(100) },
        ],
      },
      {
        id: "g2", name: "Study squad", members: [YOU, "Priya", "Leo", "Ana"],
        messages: [
          { id: "m4", author: "Leo", text: "Midterm review at the library tomorrow?", at: ago(300) },
          { id: "m5", author: "Leo", hangoutId: "h2", at: ago(295) },
        ],
      },
      {
        id: "g3", name: "Floor 3", members: [YOU, "Sam", "Dee", "Marcus", "Tess"],
        messages: [
          { id: "m6", author: "Dee", text: "Dining hall tonight? Taco bar!", at: ago(60) },
          { id: "m7", author: "Dee", hangoutId: "h3", at: ago(58) },
        ],
      },
    ],
    hangouts: [
      { id: "h3", groupId: "g3", title: "Taco night", place: "Visceglia Art Building / Student Center", when: at(0, 18, 0), by: "Dee", len: 75, rsvps: { Dee: "yes", Sam: "yes", Tess: "yes" } },
      { id: "h2", groupId: "g2", title: "Midterm review", place: "Jennings Library, room 3B", when: at(1, 11, 15), by: "Leo", len: 120, rsvps: { Leo: "yes", Priya: "yes", Ana: "yes", [YOU]: "yes" } },
      { id: "h4", groupId: "g1", title: "Quick coffee", place: "Jennings Library", when: at(1, 12, 0), by: "Maya", len: 45, rsvps: { Maya: "yes" } },
      { id: "h5", groupId: "g3", title: "Movie night", place: "Alumni Theatre", when: at(2, 19, 30), by: "Marcus", len: 150, rsvps: { Marcus: "yes", Sam: "yes", [YOU]: "yes" } },
      { id: "h6", groupId: "g2", title: "Frisbee on the quad", place: "Mt. St. Dominic Athletic Center", when: at(3, 15, 0), by: "Ana", len: 60, rsvps: { Ana: "yes", Leo: "no", [YOU]: "no" } },
      { id: "h1", groupId: "g1", title: "Coffee break", place: "Visceglia Art Building / Student Center", when: at(4, 10, 0), by: "Maya", len: 90, rsvps: { Maya: "yes", Jordan: "yes", Priya: "no" } },
      { id: "h7", groupId: "g3", title: "Farmers market run", place: "George R. Newman Center", when: at(5, 14, 0), by: "Tess", len: 90, rsvps: { Tess: "yes", Dee: "yes" } },
      { id: "h8", groupId: "g1", title: "Game night", place: "Dominican Hall lounge", when: at(6, 20, 0), by: "Jordan", len: 120, rsvps: { Jordan: "yes", Maya: "yes", [YOU]: "yes" } },
      { id: "h9", groupId: "g2", title: "Pizza and problem set", place: "Werner Hall / Academic Building", when: at(8, 17, 30), by: "Priya", len: 120, rsvps: { Priya: "yes", Leo: "yes" } },
    ],
  };
}

function load(): State {
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s) as State; } catch { /* storage unavailable */ }
  return seed();
}

let state: State = load();
const subs = new Set<() => void>();
function set(next: State) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  subs.forEach((f) => f());
}
const patchGroup = (id: string, fn: (g: Group) => Group) => set({ ...state, groups: state.groups.map((g) => (g.id === id ? fn(g) : g)) });

const HANG_LEN = 90;
/** A hangout you organize or said yes to that overlaps `when`, so you cannot be in two places at once. */
export function findConflict(when: string, len = HANG_LEN): Hangout | undefined {
  const a0 = new Date(when).getTime(), a1 = a0 + len * 60000;
  return state.hangouts.find((h) => {
    if (h.canceled || !state.groups.some((g) => g.id === h.groupId)) return false;
    if (h.by !== YOU && h.rsvps[YOU] !== "yes") return false;
    const b0 = new Date(h.when).getTime(), b1 = b0 + (h.len ?? HANG_LEN) * 60000;
    return a0 < b1 && b0 < a1;
  });
}

export const hangActions = {
  createGroup(name: string, members: string[]) {
    const id = crypto.randomUUID();
    set({ ...state, groups: [...state.groups, { id, name, members: [YOU, ...members], messages: [] }] });
    progress.log("group");
    return id;
  },
  send(groupId: string, text: string) {
    patchGroup(groupId, (g) => ({ ...g, messages: [...g.messages, { id: crypto.randomUUID(), author: YOU, text, at: new Date().toISOString() }] }));
  },
  createHangout(groupId: string, h: { title: string; place: string; when: string }) {
    const id = crypto.randomUUID();
    set({
      groups: state.groups.map((g) => (g.id === groupId ? { ...g, messages: [...g.messages, { id: crypto.randomUUID(), author: YOU, hangoutId: id, at: new Date().toISOString() }] } : g)),
      hangouts: [...state.hangouts, { id, groupId, ...h, by: YOU, rsvps: { [YOU]: "yes" } }],
    });
    progress.log("plan");
  },
  /** Cancelling only hides a hangout, so it can be brought back with Undo. */
  setCanceled(hangoutId: string, canceled: boolean) {
    set({ ...state, hangouts: state.hangouts.map((h) => (h.id === hangoutId ? { ...h, canceled } : h)) });
  },
  addMembers(groupId: string, names: string[]) {
    patchGroup(groupId, (g) => ({ ...g, members: [...g.members, ...names.filter((n) => !g.members.includes(n))] }));
  },
  setRsvp(hangoutId: string, answer: Rsvp | null) {
    set({
      ...state,
      hangouts: state.hangouts.map((h) => {
        if (h.id !== hangoutId) return h;
        const rsvps = { ...h.rsvps };
        if (answer) rsvps[YOU] = answer; else delete rsvps[YOU];
        return { ...h, rsvps };
      }),
    });
    if (answer) progress.log(answer === "yes" ? "rsvpYes" : "rsvpNo");
  },
};

export const useHang = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
