import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { watchTables, type ChangeEvent } from "./people";
import { readCache, writeCache } from "./localCache";
import { notice } from "./notice";

/** Campus events: the big public ones put on by a host (a department, club, instructor or staff member) and shown to everyone on the campus.
 *  Groups stay for small private hangouts. Only people in the `campus_hosts` list can post; everyone can say going or interested. */
export type Answer = "going" | "interested";
export type RawEvent = { id: string; host_id: string; host_label: string; title: string; description: string; place_name: string; starts_at: string; ends_at: string | null; canceled_at: string | null };
export type RawAnswer = { event_id: string; user_id: string; answer: Answer };
export type CampusEvent = {
  id: string; hostId: string; host: string; title: string; description: string; place: string;
  startsAt: string; endsAt?: string; canceled: boolean; going: number; interested: number; mine?: Answer; mineHost: boolean;
};

const HOUR = 3600000;

/** Pure: rows in, what the screen shows. Soonest first; cancelled events stay in the list (marked) so people who planned around them see it. */
export function buildEvents(events: RawEvent[], answers: RawAnswer[], me: string): CampusEvent[] {
  return [...events]
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map((e) => {
      const mine = answers.find((a) => a.event_id === e.id && a.user_id === me)?.answer;
      const of = answers.filter((a) => a.event_id === e.id);
      return {
        id: e.id, hostId: e.host_id, host: e.host_label, title: e.title, description: e.description, place: e.place_name,
        startsAt: e.starts_at, endsAt: e.ends_at ?? undefined, canceled: !!e.canceled_at,
        going: of.filter((a) => a.answer === "going").length, interested: of.filter((a) => a.answer === "interested").length,
        mine, mineHost: e.host_id === me,
      };
    });
}

/** Events that have not finished yet (an event with no end time counts as over three hours after it starts). */
export const isOpen = (e: { startsAt: string; endsAt?: string }, now: Date) => new Date(e.endsAt ?? new Date(new Date(e.startsAt).getTime() + 3 * HOUR)).getTime() >= now.getTime();

/** What is wrong with a new event, in plain words, or null. */
export function problemWithEvent(d: { title: string; startsAt: string; endsAt?: string }, now = new Date()): string | null {
  if (!d.title.trim()) return "Give the event a title.";
  if (!d.startsAt || Number.isNaN(new Date(d.startsAt).getTime())) return "Pick when it starts.";
  if (new Date(d.startsAt).getTime() < now.getTime() - 5 * 60000) return "That start time has already passed.";
  if (d.endsAt && new Date(d.endsAt).getTime() <= new Date(d.startsAt).getTime()) return "It has to end after it starts.";
  return null;
}

type Store = { events: RawEvent[]; answers: RawAnswer[]; hostLabel: string | null; ready: boolean };

/** Pure: one change from the database applied to the lists. Returns null when it should simply be looked up again. */
export function applyEventChange(s: Pick<Store, "events" | "answers">, e: ChangeEvent): Pick<Store, "events" | "answers"> | null {
  if (e.table === "campus_events") {
    if (e.type === "DELETE") { const id = e.old.id as string | undefined; return id ? { events: s.events.filter((x) => x.id !== id), answers: s.answers.filter((a) => a.event_id !== id) } : null; }
    const r = e.row as unknown as RawEvent;
    if (!r.id) return null;
    const has = s.events.some((x) => x.id === r.id);
    return { answers: s.answers, events: has ? s.events.map((x) => (x.id === r.id ? { ...x, ...r } : x)) : [...s.events, r] };
  }
  if (e.table === "campus_event_responses") {
    const r = (e.type === "DELETE" ? e.old : e.row) as Partial<RawAnswer>;
    if (!r.event_id || !r.user_id) return null;
    const rest = s.answers.filter((a) => !(a.event_id === r.event_id && a.user_id === r.user_id));
    if (e.type === "DELETE") return { events: s.events, answers: rest };
    if (!r.answer) return null;
    return { events: s.events, answers: [...rest, { event_id: r.event_id, user_id: r.user_id, answer: r.answer }] };
  }
  return null;
}

/* ---------- store ---------- */
const live = !!supabase;
const DEMO_KEY = "orbit-demo-campus-events";
const demoSamples = (): Store => {
  const at = (d: number, h: number, m = 0) => { const t = new Date(); t.setDate(t.getDate() + d); t.setHours(h, m, 0, 0); return t.toISOString(); };
  const mk = (id: string, host: string, title: string, description: string, place: string, d: number, h: number, m = 0, len = 90): RawEvent => ({ id, host_id: `demo-host-${host}`, host_label: host, title, description, place_name: place, starts_at: at(d, h, m), ends_at: new Date(new Date(at(d, h, m)).getTime() + len * 60000).toISOString(), canceled_at: null });
  return {
    events: [
      mk("ce1", "University Library", "Study skills workshop", "Time management and note-taking for midterms. Bring a laptop. Snacks provided.", "Library, room 2B", 1, 16, 0, 60),
      mk("ce2", "Career Services", "Spring career fair", "Over 40 employers. Dress business casual and bring printed resumes.", "Main gym", 3, 10, 0, 300),
      mk("ce3", "Student Life", "Open mic night", "Sign up at the door. Music, poetry and comedy.", "Student Center café", 2, 19, 30, 120),
    ],
    answers: [], hostLabel: "Orbit demo", ready: true,
  };
};
let state: Store = live ? { events: [], answers: [], hostLabel: null, ready: false } : (() => { try { const s = localStorage.getItem(DEMO_KEY); if (s) return JSON.parse(s) as Store; } catch { /* none saved */ } return demoSamples(); })();
let who: string | null = null;
let stop: (() => void) | null = null;
let loadId = 0;
const subs = new Set<() => void>();
function set(next: Store) {
  state = next;
  if (!live) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(state)); } catch { /* ignore */ } }
  else if (who && state.ready) writeCache("campus-events", who, state);
  subs.forEach((f) => f());
}
const DEMO_ME = "demo-me";

async function reload() {
  if (!who) return;
  const me = who, mine = ++loadId;
  try {
    const since = new Date(Date.now() - 24 * HOUR).toISOString();
    const [ev, host] = await Promise.all([
      supabase!.from("campus_events").select("id,host_id,host_label,title,description,place_name,starts_at,ends_at,canceled_at").gte("starts_at", since).order("starts_at", { ascending: true }).limit(300),
      supabase!.from("campus_hosts").select("label").eq("user_id", me).maybeSingle(),
    ]);
    // Before the campus events migration is applied the tables are missing: show an empty list, never an error.
    if (ev.error) { if (mine === loadId && who === me) set({ ...state, events: [], answers: [], ready: true }); return; }
    const events = (ev.data ?? []) as RawEvent[];
    const ans = events.length ? await supabase!.from("campus_event_responses").select("event_id,user_id,answer").in("event_id", events.map((e) => e.id)).limit(5000) : { data: [] as RawAnswer[], error: null };
    if (mine !== loadId || who !== me) return;
    set({ events, answers: (ans.data ?? []) as RawAnswer[], hostLabel: (host.data as { label: string } | null)?.label ?? null, ready: true });
  } catch { /* keep what is on screen */ }
}

export function bindCampusEvents(userId: string) {
  if (!live || who === userId) return;
  unbindCampusEvents();
  who = userId;
  const kept = readCache<Store>("campus-events", userId);
  if (kept) state = { ...kept, ready: true };
  void reload();
  stop = watchTables(`orbit-events-${userId}`, ["campus_events", "campus_event_responses"], () => void reload(), (e) => {
    const next = applyEventChange(state, e);
    if (!next) return false;
    set({ ...state, ...next });
    return true;
  });
}
export function unbindCampusEvents() {
  if (!live) return;
  stop?.(); stop = null; who = null; loadId++;
  state = { events: [], answers: [], hostLabel: null, ready: false };
  subs.forEach((f) => f());
}

export const eventActions = {
  /** Post an event (hosts only). Resolves to a message if it did not work, or null. */
  async create(d: { title: string; description: string; place: string; startsAt: string; endsAt?: string }): Promise<string | null> {
    const bad = problemWithEvent(d);
    if (bad) return bad;
    const row = { title: d.title.trim().slice(0, 120), description: d.description.trim().slice(0, 1000), place_name: d.place.trim().slice(0, 120), starts_at: new Date(d.startsAt).toISOString(), ends_at: d.endsAt ? new Date(d.endsAt).toISOString() : null };
    if (!live) {
      const e: RawEvent = { id: crypto.randomUUID(), host_id: DEMO_ME, host_label: state.hostLabel ?? "Orbit demo", canceled_at: null, ...row };
      set({ ...state, events: [...state.events, e] });
      return null;
    }
    if (!who) return "Sign in first.";
    const { data: member } = await supabase!.from("campus_memberships").select("campus_key").eq("user_id", who).maybeSingle();
    const { error } = await supabase!.from("campus_events").insert({ ...row, host_id: who, campus_key: (member as { campus_key: string } | null)?.campus_key, host_label: state.hostLabel ?? "Host" });
    if (error) return /row-level|42501|only campus hosts/i.test(error.message) ? "Your account is not set up to post campus events yet." : error.message;
    return null;
  },
  async cancel(id: string): Promise<string | null> {
    const at = new Date().toISOString();
    set({ ...state, events: state.events.map((e) => (e.id === id ? { ...e, canceled_at: at } : e)) });
    if (!live) return null;
    const { error } = await supabase!.from("campus_events").update({ canceled_at: at }).eq("id", id);
    if (error) { notice.show({ icon: "alert", title: "That did not cancel", message: error.message }); void reload(); return error.message; }
    return null;
  },
  /** Say going or interested, or take it back with null. Shows at once, then saves. */
  respond(id: string, answer: Answer | null) {
    const me = live ? who : DEMO_ME;
    if (!me) return;
    const rest = state.answers.filter((a) => !(a.event_id === id && a.user_id === me));
    set({ ...state, answers: answer ? [...rest, { event_id: id, user_id: me, answer }] : rest });
    if (!live) return;
    const job = answer
      ? supabase!.from("campus_event_responses").upsert({ event_id: id, user_id: me, answer, updated_at: new Date().toISOString() })
      : supabase!.from("campus_event_responses").delete().eq("event_id", id).eq("user_id", me);
    Promise.resolve(job).then(({ error }) => { if (error) throw new Error(error.message); }).catch((e: Error) => { notice.show({ icon: "alert", title: "Your answer did not save", message: e.message }); void reload(); });
  },
};

export function useCampusEvents() {
  const s = useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
  const me = live ? who ?? "" : DEMO_ME;
  return { events: buildEvents(s.events, s.answers, me), isHost: live ? !!s.hostLabel : true, hostLabel: s.hostLabel, ready: s.ready };
}
