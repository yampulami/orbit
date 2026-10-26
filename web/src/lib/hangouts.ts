import { useSyncExternalStore } from "react";
import { progress } from "./progress";
import { supabase } from "./supabase";
import { notice } from "./notice";
import { fetchChange, listenRooms, sendNudge, type Nudge } from "./nudge";
import { applyMessage, buildState, labelerFor, loadRaw, watch } from "./hangoutsDb";
import { YOU, type Group, type HangState, type Hangout, type Msg, type Rsvp } from "./hangTypes";

/** Friend groups, group chat and hangout answers. With a database they live there (private to each group, joined with an invite code, live for
 *  everyone in the group). Without one (demo mode) they are saved on this device only. The screens cannot tell the difference. */
export { YOU };
export type { Group, Hangout, Msg, Rsvp };
type State = HangState;

const KEY = "orbit-hangouts-v4";
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
      { id: "h10", groupId: "", title: "Open mic night", place: "Alumni Theatre", when: at(2, 17, 0), by: "Tess", len: 120, visibility: "campus", rsvps: { Tess: "yes", Dee: "yes", Sam: "yes", Maya: "yes" } },
      { id: "h9", groupId: "g2", title: "Pizza and problem set", place: "Werner Hall / Academic Building", when: at(8, 17, 30), by: "Priya", len: 120, rsvps: { Priya: "yes", Leo: "yes" } },
    ],
  };
}

function load(): State {
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s) as State; } catch { /* storage unavailable */ }
  return seed();
}

const live = !!supabase;
let state: State = live ? { groups: [], hangouts: [] } : load();
let status: "idle" | "loading" | "ready" | "error" = live ? "idle" : "ready";
const subs = new Set<() => void>();
function set(next: State) {
  state = next;
  if (!live) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }
  subs.forEach((f) => f());
}

/* ---------- database mode ---------- */
let who: { id: string; name: string; campusKey: string } | null = null;
let stopWatching: (() => void) | null = null;
let loadId = 0;
let nameOf: (id: string) => string | undefined = () => undefined;
let epoch = 0; // counts changes applied straight from the live connection

async function reload() {
  if (!who) return;
  const mine = ++loadId, e0 = epoch;
  try {
    const raw = await loadRaw(who.id);
    const next = buildState(raw);
    if (mine !== loadId || !who) return; // a newer load or a sign out came first
    if (epoch !== e0) { void reload(); return; } // a message arrived while this was loading: this answer may be older than it
    nameOf = labelerFor(raw);
    status = "ready";
    set(next);
    listenRooms("hangouts", next.groups.map((g) => g.id), onNudge);
  } catch (e) {
    status = "error";
    subs.forEach((f) => f());
    notice.show({ icon: "wifi", title: "Groups and hangouts did not load", message: `${(e as Error).message || "Something went wrong."} Check your connection and try again.` });
  }
}

/** Someone sent a chat message: show it now, ahead of the database's own change feed. */
async function onNudge(n: Nudge) {
  if (n.table !== "group_messages" || n.op !== "upsert") return;
  const change = await fetchChange(n.table, n.id).catch(() => null);
  if (!change) return;
  const next = applyMessage(state, nameOf, change);
  if (next) { epoch++; if (next !== state) set(next); } else void reload(); // an unknown group or person, or a message about a plan
}

/** Start using the database for this signed-in student. Call once the person and their campus are known. */
export function bindHang(user: { id: string; name: string; campusKey: string }) {
  if (!live) return;
  if (who?.id === user.id) { who = user; return; }
  unbindHang();
  who = user;
  status = "loading";
  subs.forEach((f) => f());
  void reload();
  stopWatching = watch(user.id, () => void reload(), (e) => {
    // A new chat message shows at once, without fetching groups, hangouts and answers all over again.
    const next = applyMessage(state, nameOf, e);
    if (!next) return false;
    epoch++;
    if (next !== state) set(next);
    return true;
  });
}

/** The signed-in student changed their name: new messages and plans carry it. */
export function setHangName(name: string) { if (who) who = { ...who, name }; }

/** Stop, and forget everything, for example when someone signs out. The next person must never see this person's groups. */
export function unbindHang() {
  if (!live) return;
  stopWatching?.(); stopWatching = null;
  who = null; loadId++; nameOf = () => undefined; listenRooms("hangouts", [], onNudge);
  status = "idle";
  set({ groups: [], hangouts: [] });
}

/** Run a database change; if it fails, say why in plain words and show what is really there. */
function run(what: string, job: () => PromiseLike<{ error: { message: string } | null }>, afterSave?: () => void) {
  Promise.resolve(job()).then(({ error }) => {
    if (error) throw new Error(error.message);
    afterSave?.();
  }).catch((e: Error) => {
    notice.show({ icon: "alert", title: `${what} did not work`, message: e.message || "Something went wrong. Try again." });
    void reload();
  });
}
const patchGroup = (id: string, fn: (g: Group) => Group) => set({ ...state, groups: state.groups.map((g) => (g.id === id ? fn(g) : g)) });

const HANG_LEN = 90;
/** A hangout you organize or said yes to that overlaps `when`, so you cannot be in two places at once. */
export function findConflict(when: string, len = HANG_LEN): Hangout | undefined {
  const a0 = new Date(when).getTime(), a1 = a0 + len * 60000;
  return state.hangouts.find((h) => {
    if (!isVisible(h, state.groups)) return false;
    if (h.by !== YOU && h.rsvps[YOU] !== "yes") return false;
    const b0 = new Date(h.when).getTime(), b1 = b0 + (h.len ?? HANG_LEN) * 60000;
    return a0 < b1 && b0 < a1;
  });
}

/** Is this hangout something the person can see: one of their groups, or a public one open to the whole campus? Cancelled ones are never shown. */
export const isVisible = (h: Hangout, groups: { id: string }[]) => !h.canceled && (h.visibility === "campus" || groups.some((g) => g.id === h.groupId));

export const hangActions = {
  createGroup(name: string, members: string[], household = false) {
    const id = crypto.randomUUID();
    set({ ...state, groups: [...state.groups, { id, name, members: [YOU, ...members], messages: [] }] });
    if (live && who) {
      // The database makes the group, adds you, and hands back the invite code that friends use to join.
      supabase!.rpc(household ? "create_household" : "create_friend_group", { gid: id, gname: name }).then(({ data, error }) => {
        if (error) throw new Error(error.message);
        set({ ...state, groups: state.groups.map((g) => (g.id === id ? { ...g, code: String(data) } : g)) });
      }).then(undefined, (e: Error) => { notice.show({ icon: "alert", title: "The group was not made", message: e.message }); void reload(); });
    }
    progress.log("group");
    return id;
  },
  send(groupId: string, text: string) {
    const mid = crypto.randomUUID();
    patchGroup(groupId, (g) => ({ ...g, messages: [...g.messages, { id: mid, author: YOU, text, at: new Date().toISOString() }] }));
    if (live && who) run("Sending that message", () => supabase!.from("group_messages").insert({ id: mid, group_id: groupId, sender_id: who!.id, sender_name: who!.name, body: text }), () => sendNudge(groupId, { table: "group_messages", id: mid, op: "upsert" }));
  },
  createHangout(groupId: string, h: { title: string; place: string; when: string; visibility?: "group" | "campus" }) {
    const id = crypto.randomUUID();
    if (live && who) {
      const w = who;
      run("Planning that hangout", async () => {
        const made = await supabase!.from("campus_hangouts").insert({ id, campus_key: w.campusKey, group_id: groupId, visibility: h.visibility ?? "group", created_by: w.id, title: h.title, place_name: h.place, starts_at: h.when, duration_minutes: 90 });
        if (made.error) return made;
        return supabase!.from("group_messages").insert({ id: crypto.randomUUID(), group_id: groupId, sender_id: w.id, sender_name: w.name, body: h.title, hangout_id: id });
      });
    }
    set({
      groups: state.groups.map((g) => (g.id === groupId ? { ...g, messages: [...g.messages, { id: crypto.randomUUID(), author: YOU, hangoutId: id, at: new Date().toISOString() }] } : g)),
      hangouts: [...state.hangouts, { id, groupId, ...h, by: YOU, rsvps: { [YOU]: "yes" } }],
    });
    progress.log("plan");
  },
  /** Cancelling only hides a hangout, so it can be brought back with Undo. */
  setCanceled(hangoutId: string, canceled: boolean) {
    set({ ...state, hangouts: state.hangouts.map((h) => (h.id === hangoutId ? { ...h, canceled } : h)) });
    if (live && who) run("Cancelling that hangout", () => supabase!.from("campus_hangouts").update({ canceled_at: canceled ? new Date().toISOString() : null }).eq("id", hangoutId));
  },
  /** Demo mode only: people are typed names. With a database, friends join with the group's invite code instead. */
  addMembers(groupId: string, names: string[]) {
    if (live) return;
    patchGroup(groupId, (g) => ({ ...g, members: [...g.members, ...names.filter((n) => !g.members.includes(n))] }));
  },
  /** Join a group with an invite code (database mode). Resolves to an error message, or null on success. */
  async joinWithCode(code: string): Promise<string | null> {
    if (!live || !who) return "Joining with a code needs an account.";
    const { error } = await supabase!.rpc("join_group_with_code", { invite: code.trim() });
    if (error) return error.message;
    await reload();
    return null;
  },
  /** Replace a group's invite code (only the person who made the group can). */
  async newCode(groupId: string): Promise<string | null> {
    if (!live || !who) return "Not available here.";
    const { data, error } = await supabase!.rpc("regenerate_group_code", { gid: groupId });
    if (error) return error.message;
    set({ ...state, groups: state.groups.map((g) => (g.id === groupId ? { ...g, code: String(data) } : g)) });
    return null;
  },
  setRsvp(hangoutId: string, answer: Rsvp | null) {
    if (live && who) {
      const w = who;
      run("Saving your answer", () => (answer
        ? supabase!.from("campus_hangout_rsvps").upsert({ hangout_id: hangoutId, user_id: w.id, answer, updated_at: new Date().toISOString() })
        : supabase!.from("campus_hangout_rsvps").delete().eq("hangout_id", hangoutId).eq("user_id", w.id)));
    }
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

/** "ready" once the groups and hangouts have loaded (always, in demo mode). */
export const useHangStatus = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => status);
export const hangLive = live;

export const useHang = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
