import { useSyncExternalStore } from "react";
import { progress } from "./progress";

/** Friend groups, group chat and hangout RSVPs. Saved on this device only until groups sync to the server. */
export const YOU = "You";

export type Rsvp = "yes" | "no";
export type Msg = { id: string; author: string; text?: string; hangoutId?: string; at: string };
export type Group = { id: string; name: string; members: string[]; messages: Msg[] };
export type Hangout = { id: string; groupId: string; title: string; place: string; when: string; by: string; rsvps: Record<string, Rsvp>; canceled?: boolean };
type State = { groups: Group[]; hangouts: Hangout[] };

const KEY = "orbit-hangouts-v1";
const ago = (m: number) => new Date(Date.now() - m * 60000).toISOString();

function seed(): State {
  const sat = new Date();
  sat.setDate(sat.getDate() + ((6 - sat.getDay() + 7) % 7 || 7));
  sat.setHours(10, 0, 0, 0);
  return {
    groups: [{
      id: "g1", name: "Coffee crew", members: [YOU, "Maya", "Jordan", "Priya"],
      messages: [
        { id: "m1", author: "Maya", text: "Anyone free this weekend? I need caffeine and a break from the library.", at: ago(120) },
        { id: "m2", author: "Jordan", text: "Yes! Let’s do coffee somewhere on campus.", at: ago(110) },
        { id: "m3", author: "Maya", hangoutId: "h1", at: ago(100) },
      ],
    }],
    hangouts: [{ id: "h1", groupId: "g1", title: "Coffee break", place: "Student Center café", when: sat.toISOString(), by: "Maya", rsvps: { Maya: "yes", Jordan: "yes", Priya: "no" } }],
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
