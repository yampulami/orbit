import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { watchTables, type ChangeEvent } from "./people";
import { readCache, writeCache } from "./localCache";
import { notice } from "./notice";
import { useMyOrgIds } from "./campusOrgs";

/** Campus events: the big public ones put on by a host (a department, club, instructor or staff member) and shown to everyone on the campus.
 *  Groups stay for small private hangouts. Only people in the `campus_hosts` list can post; everyone can say going or interested. */
export type Answer = "going" | "interested";
export type Role = "coordinator" | "staff" | "student";
export type Kind = "official" | "student";
export type Status = "pending" | "published" | "rejected" | "removed";
export type RawEvent = { id: string; org_id?: string | null; host_id: string; host_label: string; kind: Kind; status: Status; title: string; description: string; place_name: string; starts_at: string; ends_at: string | null; canceled_at: string | null; review_note?: string | null };
export type RawAnswer = { event_id: string; user_id: string; answer: Answer };
export type RawReport = { event_id: string; reporter_id: string; reason: string };
export type CampusEvent = {
  id: string; orgId?: string; hostId: string; host: string; title: string; description: string; place: string;
  startsAt: string; endsAt?: string; canceled: boolean; going: number; interested: number; mine?: Answer; mineHost: boolean;
  /** "official" is posted by staff; "student" is posted by a student host and needs a staff member to approve it. */
  kind: Kind; status: Status; note?: string;
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
        id: e.id, orgId: e.org_id ?? undefined, hostId: e.host_id, host: e.host_label, title: e.title, description: e.description, place: e.place_name,
        startsAt: e.starts_at, endsAt: e.ends_at ?? undefined, canceled: !!e.canceled_at,
        going: of.filter((a) => a.answer === "going").length, interested: of.filter((a) => a.answer === "interested").length,
        mine, mineHost: e.host_id === me, kind: e.kind ?? "official", status: e.status ?? "published", note: e.review_note ?? undefined,
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

/** What the database does when this role posts: staff and coordinators publish officially at once; student hosts wait for approval. */
export const outcomeFor = (role: Role): { kind: Kind; status: Status } => (role === "student" ? { kind: "student", status: "pending" } : { kind: "official", status: "published" });
export const canReview = (role: Role | null) => role === "coordinator" || role === "staff";

/** Waiting and declined events are for their host and for reviewers only; everyone else sees published ones. */
export const visibleEvents = (list: CampusEvent[], reviewer: boolean, myOrgs: Set<string> = new Set()) => list.filter((e) => e.status === "published" || e.mineHost || reviewer || (!!e.orgId && myOrgs.has(e.orgId)));

/** What a host sees on an event they cannot see live, in words. */
export const statusNote = (s: Status) => (s === "pending" ? "Waiting for approval" : s === "rejected" ? "Not approved" : s === "removed" ? "Removed by a coordinator" : "");

type Store = { events: RawEvent[]; answers: RawAnswer[]; reports: RawReport[]; hostLabel: string | null; role: Role | null; ready: boolean };

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
const DEMO_ROLE_KEY = "orbit-demo-role";
const demoRole = (): Role => { try { const r = localStorage.getItem(DEMO_ROLE_KEY); if (r === "student" || r === "staff" || r === "coordinator") return r; } catch { /* default */ } return "coordinator"; };
const demoSamples = (): Store => {
  const at = (d: number, h: number, m = 0) => { const t = new Date(); t.setDate(t.getDate() + d); t.setHours(h, m, 0, 0); return t.toISOString(); };
  const mk = (id: string, host: string, title: string, description: string, place: string, d: number, h: number, m = 0, len = 90): RawEvent => ({ id, host_id: `demo-host-${host}`, host_label: host, title, description, place_name: place, starts_at: at(d, h, m), ends_at: new Date(new Date(at(d, h, m)).getTime() + len * 60000).toISOString(), canceled_at: null, kind: "official", status: "published" });
  const student = (e: RawEvent): RawEvent => ({ ...e, kind: "student", host_id: "demo-host-club" });
  return {
    events: [
      mk("ce1", "University Library", "Study skills workshop", "Time management and note-taking for midterms. Bring a laptop. Snacks provided.", "Library, room 2B", 1, 16, 0, 60),
      mk("ce2", "Career Services", "Spring career fair", "Over 40 employers. Dress business casual and bring printed resumes.", "Main gym", 3, 10, 0, 300),
      { ...student(mk("ce3", "Robotics Club", "Open build night", "No experience needed. Come and build with us. Snacks provided.", "Engineering lab", 2, 19, 30, 120)), org_id: "o1" },
      { ...student(mk("ce4", "Film Society", "Outdoor movie screening", "Bring a blanket. Free popcorn.", "North lawn", 4, 20, 0, 150)), status: "pending", org_id: "o3" },
    ],
    answers: [], reports: [], hostLabel: "Orbit demo", role: "coordinator", ready: true,
  };
};
let state: Store = live ? { events: [], answers: [], reports: [], hostLabel: null, role: null, ready: false } : (() => { try { const s = localStorage.getItem(DEMO_KEY); if (s) { const saved = JSON.parse(s) as Store; return { ...saved, reports: saved.reports ?? [], role: demoRole() }; } } catch { /* none saved */ } return { ...demoSamples(), role: demoRole() }; })();
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
      supabase!.from("campus_events").select("id,org_id,host_id,host_label,kind,status,title,description,place_name,starts_at,ends_at,canceled_at,review_note").gte("starts_at", since).order("starts_at", { ascending: true }).limit(300),
      supabase!.from("campus_hosts").select("label,role").eq("user_id", me).maybeSingle(),
    ]);
    // Before the campus events migration is applied the tables are missing: show an empty list, never an error.
    if (ev.error) { if (mine === loadId && who === me) set({ ...state, events: [], answers: [], ready: true }); return; }
    const events = (ev.data ?? []) as RawEvent[];
    const ans = events.length ? await supabase!.from("campus_event_responses").select("event_id,user_id,answer").in("event_id", events.map((e) => e.id)).limit(5000) : { data: [] as RawAnswer[], error: null };
    if (mine !== loadId || who !== me) return;
    const h = host.data as { label: string; role: Role } | null;
    // Only reviewers can read reports; for everyone else this simply comes back empty.
    const rep = canReview(h?.role ?? null) ? await supabase!.from("campus_event_reports").select("event_id,reporter_id,reason").limit(1000) : { data: [] as RawReport[], error: null };
    set({ events, answers: (ans.data ?? []) as RawAnswer[], reports: rep.error ? [] : ((rep.data ?? []) as RawReport[]), hostLabel: h?.label ?? null, role: h?.role ?? null, ready: true });
  } catch { /* keep what is on screen */ }
}

export function bindCampusEvents(userId: string) {
  if (!live || who === userId) return;
  unbindCampusEvents();
  who = userId;
  const kept = readCache<Store>("campus-events", userId);
  // A copy saved by an older version may lack lists added since: fill them in rather than crash.
  if (kept) state = { ...kept, events: kept.events ?? [], answers: kept.answers ?? [], reports: kept.reports ?? [], ready: true };
  void reload();
  stop = watchTables(`orbit-events-${userId}`, ["campus_events", "campus_event_responses", "campus_event_reports"], () => void reload(), (e) => {
    const next = applyEventChange(state, e);
    if (!next) return false;
    set({ ...state, ...next });
    return true;
  });
}
export function unbindCampusEvents() {
  if (!live) return;
  stop?.(); stop = null; who = null; loadId++;
  state = { events: [], answers: [], reports: [], hostLabel: null, role: null, ready: false };
  subs.forEach((f) => f());
}

export const eventActions = {
  /** Post an event (hosts only). Staff and coordinators publish at once; a student host's event waits for approval. Resolves to a message if it
   *  did not work, or null, plus the outcome so the screen can say which. */
  async create(d: { title: string; description: string; place: string; startsAt: string; endsAt?: string; orgId?: string; orgName?: string; orgKind?: Kind; orgTrusted?: boolean }): Promise<{ error: string | null; status?: Status }> {
    const bad = problemWithEvent(d);
    if (bad) return { error: bad };
    const row = { title: d.title.trim().slice(0, 120), description: d.description.trim().slice(0, 1000), place_name: d.place.trim().slice(0, 120), starts_at: new Date(d.startsAt).toISOString(), ends_at: d.endsAt ? new Date(d.endsAt).toISOString() : null };
    const role = state.role ?? "student";
    if (!live) {
      const e: RawEvent = d.orgId
        ? { id: crypto.randomUUID(), org_id: d.orgId, host_id: DEMO_ME, host_label: d.orgName ?? "Organization", canceled_at: null, kind: d.orgKind ?? "student", status: d.orgKind === "official" || d.orgTrusted ? "published" : "pending", ...row }
        : { id: crypto.randomUUID(), host_id: DEMO_ME, host_label: state.hostLabel ?? "Orbit demo", canceled_at: null, ...outcomeFor(role), ...row };
      set({ ...state, events: [...state.events, e] });
      return { error: null, status: e.status };
    }
    if (!who) return { error: "Sign in first." };
    const { data: member } = await supabase!.from("campus_memberships").select("campus_key").eq("user_id", who).maybeSingle();
    // The database decides the kind and the status from the host's role; none is sent from here.
    const { data, error } = await supabase!.from("campus_events").insert({ ...row, host_id: who, campus_key: (member as { campus_key: string } | null)?.campus_key, host_label: d.orgName ?? state.hostLabel ?? "Host", org_id: d.orgId ?? null }).select("status").single();
    if (error) return { error: /row-level|42501|only campus hosts/i.test(error.message) ? "Your account is not set up to post campus events yet." : error.message };
    return { error: null, status: (data as { status: Status } | null)?.status ?? outcomeFor(role).status };
  },
  async cancel(id: string): Promise<string | null> {
    const at = new Date().toISOString();
    set({ ...state, events: state.events.map((e) => (e.id === id ? { ...e, canceled_at: at } : e)) });
    if (!live) return null;
    const { error } = await supabase!.from("campus_events").update({ canceled_at: at }).eq("id", id);
    if (error) { notice.show({ icon: "alert", title: "That did not cancel", message: error.message }); void reload(); return error.message; }
    return null;
  },
  /** A reviewer approves a waiting student event, which then shows to everyone with a "Student event" label. */
  async approve(id: string): Promise<string | null> { return review(id, "published"); },
  /** A reviewer declines a waiting student event, with a short reason the host sees. */
  async decline(id: string, note: string): Promise<string | null> { return review(id, "rejected", note.trim().slice(0, 200) || undefined); },
  /** Tell the coordinators something is wrong with an event. One report per person; they are told the first time. */
  async report(id: string, reason: string): Promise<string | null> {
    if (!live) { set({ ...state, reports: [...state.reports, { event_id: id, reporter_id: DEMO_ME, reason: reason.trim().slice(0, 200) }] }); return null; }
    if (!who) return "Sign in first.";
    const { error } = await supabase!.from("campus_event_reports").insert({ event_id: id, reporter_id: who, reason: reason.trim().slice(0, 200) });
    if (error && !/duplicate|unique/i.test(error.message)) return error.message;
    return null;
  },
  /** A coordinator takes a published event down (or brings it back). The host sees it as removed. */
  async setRemoved(id: string, removed: boolean): Promise<string | null> { return review(id, removed ? "removed" : "published"); },
  /** A coordinator clears the reports on an event that is fine. */
  async dismissReports(id: string): Promise<string | null> {
    set({ ...state, reports: state.reports.filter((r) => r.event_id !== id) });
    if (!live) return null;
    const { error } = await supabase!.from("campus_event_reports").delete().eq("event_id", id);
    if (error) { void reload(); return error.message; }
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

async function review(id: string, status: "published" | "rejected" | "removed", note?: string): Promise<string | null> {
  const before = state;
  set({ ...state, events: state.events.map((e) => (e.id === id ? { ...e, status, review_note: note ?? null } : e)) });
  if (!live) return null;
  const { error } = await supabase!.from("campus_events").update({ status, review_note: note ?? null }).eq("id", id);
  if (error) { set(before); notice.show({ icon: "alert", title: "That did not save", message: error.message }); return error.message; }
  return null;
}

/** Demo only: preview the screens as a different kind of host. */
export function setDemoRole(role: Role) {
  if (live) return;
  try { localStorage.setItem(DEMO_ROLE_KEY, role); } catch { /* ignore */ }
  set({ ...state, role });
}

export function useCampusEvents() {
  const s = useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
  const me = live ? who ?? "" : DEMO_ME;
  const reviewer = canReview(s.role);
  const myOrgs = useMyOrgIds();
  const all = buildEvents(s.events, s.answers, me);
  const events = visibleEvents(all, reviewer, myOrgs);
  return {
    events,
    /** Student events waiting for a reviewer (only reviewers see these). */
    pending: reviewer ? events.filter((e) => e.status === "pending" && !e.canceled) : [],
    /** Events people have reported, with the reasons (reviewers only). */
    reported: reviewer ? events.filter((e) => e.status === "published" && s.reports.some((r) => r.event_id === e.id)).map((e) => ({ event: e, reasons: s.reports.filter((r) => r.event_id === e.id).map((r) => r.reason).filter(Boolean) })) : [],
    isHost: live ? !!s.role : s.role !== "student", role: s.role, canReview: reviewer, hostLabel: s.hostLabel, ready: s.ready,
  };
}
