import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { loadNames, watchTables } from "./people";
import { findByUsername } from "./username";
import { notice } from "./notice";

/** Organizations: the clubs, departments and offices that put on campus events. A coordinator approves an organization once; after that its officers
 *  post events as the organization and they go live at once. "official" organizations are staff-run offices; "student" ones are clubs. */
export type OrgKind = "official" | "student";
export type OrgStatus = "pending" | "active" | "paused" | "rejected";
export type RawOrg = { id: string; name: string; description: string; kind: OrgKind; status: OrgStatus; created_by: string; review_note?: string | null; trusted?: boolean };
export type RawMember = { org_id: string; user_id: string; role: "owner" | "officer" };
export type Org = {
  id: string; name: string; description: string; kind: OrgKind; status: OrgStatus; note?: string;
  /** Its events go live at once (an official office, or a club a coordinator trusts). Otherwise each new event waits for approval. */
  trusted: boolean;
  /** I am an officer or owner of it. */
  mine: boolean; owner: boolean; members: { id: string; name: string; role: "owner" | "officer" }[];
};

/** Pure: rows in, what the screen shows. Active ones first, then by name. */
export function buildOrgs(orgs: RawOrg[], members: RawMember[], me: string, names: Record<string, string> = {}): Org[] {
  const rank: Record<OrgStatus, number> = { active: 0, pending: 1, paused: 2, rejected: 3 };
  return [...orgs]
    .map((o) => {
      const ms = members.filter((m) => m.org_id === o.id);
      return {
        id: o.id, name: o.name, description: o.description, kind: o.kind, status: o.status, note: o.review_note ?? undefined, trusted: o.kind === "official" || !!o.trusted,
        mine: ms.some((m) => m.user_id === me), owner: ms.some((m) => m.user_id === me && m.role === "owner"),
        members: ms.map((m) => ({ id: m.user_id, name: m.user_id === me ? "You" : names[m.user_id] ?? "Student", role: m.role })).sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "owner" ? -1 : 1)),
      };
    })
    .sort((a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name));
}

/** What is wrong with a new organization request, in plain words, or null. */
export function problemWithOrg(d: { name: string; description: string }): string | null {
  const name = d.name.trim();
  if (name.length < 2) return "Give the club or office a name (at least 2 letters).";
  if (name.length > 80) return "That name is a little long. Keep it under 80 characters.";
  if (d.description.trim().length > 300) return "Keep the description under 300 characters.";
  return null;
}

/** Will a new event from this club wait for a coordinator? */
export const eventsNeedApproval = (o: Pick<Org, "kind" | "trusted">) => o.kind !== "official" && !o.trusted;

/** The organizations this person can post events as. */
export const postableOrgs = (orgs: Org[]) => orgs.filter((o) => o.mine && o.status === "active");

type Store = { orgs: RawOrg[]; members: RawMember[]; names: Record<string, string>; ready: boolean };

/* ---------- store ---------- */
const live = !!supabase;
const DEMO_KEY = "orbit-demo-campus-orgs";
const DEMO_ME = "demo-me";
const demoStart = (): Store => ({
  orgs: [
    { id: "o1", name: "Robotics Club", description: "Build nights, competitions and a lot of snacks.", kind: "student", status: "active", created_by: DEMO_ME, trusted: false },
    { id: "o2", name: "Student Life", description: "Events from the Student Life office.", kind: "official", status: "active", created_by: "demo-staff" },
    { id: "o3", name: "Film Society", description: "Weekly screenings on the north lawn.", kind: "student", status: "pending", created_by: "demo-other" },
  ],
  members: [{ org_id: "o1", user_id: DEMO_ME, role: "owner" }, { org_id: "o1", user_id: "demo-sam", role: "officer" }, { org_id: "o3", user_id: "demo-other", role: "owner" }],
  names: { "demo-sam": "Sam", "demo-other": "Jordan", "demo-staff": "Staff" }, ready: true,
});
let state: Store = live ? { orgs: [], members: [], names: {}, ready: false } : (() => { try { const s = localStorage.getItem(DEMO_KEY); if (s) return JSON.parse(s) as Store; } catch { /* none saved */ } return demoStart(); })();
let who: string | null = null;
let stop: (() => void) | null = null;
let loadId = 0;
const subs = new Set<() => void>();
function set(next: Store) {
  state = next;
  if (!live) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(state)); } catch { /* ignore */ } }
  subs.forEach((f) => f());
}

async function reload() {
  if (!who) return;
  const me = who, mine = ++loadId;
  try {
    const [o, m] = await Promise.all([
      supabase!.from("campus_orgs").select("id,name,description,kind,status,created_by,review_note,trusted").order("name", { ascending: true }).limit(500),
      supabase!.from("campus_org_members").select("org_id,user_id,role").limit(3000),
    ]);
    // Before the organizations migration is applied the tables are missing: show none, never an error.
    if (o.error || m.error) { if (mine === loadId && who === me) set({ ...state, orgs: [], members: [], ready: true }); return; }
    const members = (m.data ?? []) as RawMember[];
    const names = await loadNames(members.map((x) => x.user_id)).catch(() => ({}));
    if (mine !== loadId || who !== me) return;
    set({ orgs: (o.data ?? []) as RawOrg[], members, names, ready: true });
  } catch { /* keep what is on screen */ }
}

export function bindCampusOrgs(userId: string) {
  if (!live || who === userId) return;
  unbindCampusOrgs();
  who = userId;
  void reload();
  stop = watchTables(`orbit-orgs-${userId}`, ["campus_orgs", "campus_org_members"], () => void reload());
}
export function unbindCampusOrgs() {
  if (!live) return;
  stop?.(); stop = null; who = null; loadId++;
  state = { orgs: [], members: [], names: {}, ready: false };
  subs.forEach((f) => f());
}

const me = () => (live ? who : DEMO_ME);
const fail = (title: string, message: string) => { notice.show({ icon: "alert", title, message }); return message; };

export const orgActions = {
  /** Ask for a club or office to be set up. A coordinator approves it; a coordinator's own request is approved at once. Resolves to a message or null. */
  async request(d: { name: string; description: string; reviewer: boolean; kind?: OrgKind }): Promise<{ error: string | null; status?: OrgStatus; id?: string }> {
    const bad = problemWithOrg(d);
    if (bad) return { error: bad };
    const row = { name: d.name.trim().replace(/\s+/g, " "), description: d.description.trim() };
    if (!live) {
      const status: OrgStatus = d.reviewer ? "active" : "pending";
      const id = crypto.randomUUID();
      const kind: OrgKind = d.reviewer && d.kind === "official" ? "official" : "student";
      set({ ...state, orgs: [...state.orgs, { id, ...row, kind, status, created_by: DEMO_ME, trusted: kind === "official" }], members: [...state.members, { org_id: id, user_id: DEMO_ME, role: "owner" }] });
      return { error: null, status, id };
    }
    if (!who) return { error: "Sign in first." };
    const { data: member } = await supabase!.from("campus_memberships").select("campus_key").eq("user_id", who).maybeSingle();
    const { data, error } = await supabase!.from("campus_orgs").insert({ ...row, ...(d.reviewer && d.kind ? { kind: d.kind } : {}), created_by: who, campus_key: (member as { campus_key: string } | null)?.campus_key }).select("id,status").single();
    if (error) return { error: /duplicate|unique/i.test(error.message) ? "There is already a club or office with that name on your campus." : error.message };
    const made = data as { id: string; status: OrgStatus };
    return { error: null, status: made.status, id: made.id };
  },
  /** A coordinator trusts a club (its events go live without review) or stops trusting it. */
  async setTrusted(id: string, trusted: boolean): Promise<string | null> {
    const before = state;
    set({ ...state, orgs: state.orgs.map((o) => (o.id === id ? { ...o, trusted } : o)) });
    if (!live) return null;
    const { error } = await supabase!.from("campus_orgs").update({ trusted }).eq("id", id);
    if (error) { set(before); return fail("That did not save", error.message); }
    return null;
  },
  async approve(id: string) { return decide(id, "active"); },
  async decline(id: string, note: string) { return decide(id, "rejected", note.trim().slice(0, 200) || undefined); },
  async setPaused(id: string, paused: boolean) { return decide(id, paused ? "paused" : "active"); },
  /** An owner adds an officer by username. */
  async addMember(orgId: string, username: string): Promise<string | null> {
    const found = await findByUsername(username);
    if (!found) return `Nobody on your campus has the username @${username.replace(/^@/, "")}.`;
    if (!live) {
      if (state.members.some((m) => m.org_id === orgId && m.user_id === found.id)) return null;
      set({ ...state, members: [...state.members, { org_id: orgId, user_id: found.id, role: "officer" }], names: { ...state.names, [found.id]: found.name } });
      return null;
    }
    const { error } = await supabase!.rpc("add_org_member", { org: orgId, member: found.id });
    if (error) return error.message;
    await reload();
    return null;
  },
  async removeMember(orgId: string, userId: string): Promise<string | null> {
    if (!live) { set({ ...state, members: state.members.filter((m) => !(m.org_id === orgId && m.user_id === userId)) }); return null; }
    const { error } = await supabase!.rpc("remove_org_member", { org: orgId, member: userId });
    if (error) return fail("That did not work", error.message);
    await reload();
    return null;
  },
};

async function decide(id: string, status: OrgStatus, note?: string): Promise<string | null> {
  const before = state;
  set({ ...state, orgs: state.orgs.map((o) => (o.id === id ? { ...o, status, review_note: note ?? null } : o)) });
  if (!live) return null;
  const { error } = await supabase!.from("campus_orgs").update({ status, review_note: note ?? null }).eq("id", id);
  if (error) { set(before); return fail("That did not save", error.message); }
  return null;
}

export function useCampusOrgs() {
  const s = useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
  const orgs = buildOrgs(s.orgs, s.members, me() ?? "", s.names);
  return { orgs, mine: orgs.filter((o) => o.mine), postable: postableOrgs(orgs), ready: s.ready };
}

/** The ids of the organizations this person is an officer of. */
export function useMyOrgIds(): Set<string> {
  const s = useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
  const id = me();
  return new Set(s.members.filter((m) => m.user_id === id).map((m) => m.org_id));
}
