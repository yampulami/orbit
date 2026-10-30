import { calmHue, hueFor } from "./look";
import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { loadNames, watchTables } from "./people";
import { findByUsername } from "./username";
import { notice } from "./notice";
import { permsOf, type Perm, type RawRole, type Role } from "./clubRoles";

/** Organizations: the clubs, departments and offices that put on campus events. A coordinator approves an organization once; after that its officers
 *  post events as the organization and they go live at once. "official" organizations are staff-run offices; "student" ones are clubs. */
/** "circle" is a Student Circle: quick and unofficial, no approval, no verified badge, and it does not post campus events. */
export type OrgKind = "official" | "student" | "circle";
export type OrgStatus = "pending" | "active" | "paused" | "rejected";
/** What a student fills in to ask for a club. A coordinator reads all of it before deciding. */
export type Application = { purpose: string; category: string; advisorName: string; advisorEmail: string; meeting: string; expectedMembers: number | null; firstEvent: string; contact: string };
export const CATEGORIES = ["Academic", "Arts and culture", "Sports and fitness", "Service and volunteering", "Faith and belief", "Career and professional", "Gaming and hobbies", "Other"];
export type RawOrg = {
  id: string; name: string; description: string; kind: OrgKind; status: OrgStatus; created_by: string; review_note?: string | null; trusted?: boolean; created_at?: string; reviewed_at?: string | null;
  about?: string; accent?: number | null; icon?: string; purpose?: string; category?: string; advisor_name?: string; advisor_email?: string; meeting?: string; expected_members?: number | null; first_event?: string; contact?: string;
};
export type JoinStatus = "pending" | "member" | "declined";
export type RawClubMember = { org_id: string; user_id: string; status: JoinStatus; message?: string; created_at?: string };
export type RawMember = { org_id: string; user_id: string; role: "owner" | "officer"; role_id?: string | null };
export type Org = {
  id: string; name: string; description: string; kind: OrgKind; status: OrgStatus; note?: string;
  /** Its events go live at once (an official office, or a club a coordinator trusts). Otherwise each new event waits for approval. */
  trusted: boolean;
  /** I am an officer or owner of it. */
  mine: boolean; owner: boolean; members: { id: string; name: string; role: "owner" | "officer"; roleId?: string; title?: string }[];
  /** The roles the club has made, and what I may do here. */
  roles: Role[]; myPerms: Perm[];
  application: Application; createdAt: string; decidedAt?: string; creator: string;
  /** The longer text on the club page, written by its president. */
  about: string;
  /** The club's own look: a hue and an icon (an emoji) its president chose. */
  accent?: number; icon: string;
  /** People in the club besides its officers. */
  memberCount: number;
  /** Who they are (for giving out tasks and the like). */
  clubMembers: { id: string; name: string }[];
  /** My place in it: not in it, waiting for an officer, in it, turned down, or an officer. */
  myJoin: "none" | JoinStatus | "officer";
  /** Join requests waiting for an officer (only officers and coordinators can see these). */
  requests: { id: string; name: string; message: string; at: string }[];
};

/** Pure: rows in, what the screen shows. Active ones first, then by name. */
export function buildOrgs(orgs: RawOrg[], members: RawMember[], me: string, names: Record<string, string> = {}, club: RawClubMember[] = [], roles: RawRole[] = []): Org[] {
  const rank: Record<OrgStatus, number> = { active: 0, pending: 1, paused: 2, rejected: 3 };
  return [...orgs]
    .map((o) => {
      const ms = members.filter((m) => m.org_id === o.id);
      const cm = club.filter((c) => c.org_id === o.id);
      const mineJoin = cm.find((c) => c.user_id === me)?.status;
      const rs = roles.filter((r) => r.org_id === o.id);
      return {
        id: o.id, name: o.name, description: o.description, kind: o.kind, status: o.status, note: o.review_note ?? undefined, trusted: o.kind === "official" || !!o.trusted,
        application: { purpose: o.purpose ?? "", category: o.category ?? "", advisorName: o.advisor_name ?? "", advisorEmail: o.advisor_email ?? "", meeting: o.meeting ?? "", expectedMembers: o.expected_members ?? null, firstEvent: o.first_event ?? "", contact: o.contact ?? "" },
        about: o.about ?? "", accent: typeof o.accent === "number" ? o.accent : undefined, icon: o.icon ?? "", createdAt: o.created_at ?? "", decidedAt: o.reviewed_at ?? undefined, creator: o.created_by === me ? "You" : names[o.created_by] ?? "A student",
        memberCount: cm.filter((c) => c.status === "member").length,
        clubMembers: cm.filter((c) => c.status === "member").map((c) => ({ id: c.user_id, name: c.user_id === me ? "You" : names[c.user_id] ?? "Member" })),
        myJoin: (ms.some((m) => m.user_id === me) ? "officer" : mineJoin ?? "none") as Org["myJoin"],
        requests: cm.filter((c) => c.status === "pending" && c.user_id !== me).map((c) => ({ id: c.user_id, name: names[c.user_id] ?? "Student", message: c.message ?? "", at: c.created_at ?? "" })).sort((a, b) => a.at.localeCompare(b.at)),
        roles: rs.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((r) => ({ id: r.id, name: r.name, permissions: permsOf({ role: "officer", role_id: r.id }, rs), people: ms.filter((m) => m.role_id === r.id).length })),
        myPerms: permsOf(ms.find((m) => m.user_id === me), rs),
        mine: ms.some((m) => m.user_id === me), owner: ms.some((m) => m.user_id === me && m.role === "owner"),
        members: ms.map((m) => ({ id: m.user_id, name: m.user_id === me ? "You" : names[m.user_id] ?? "Student", role: m.role, roleId: m.role_id ?? undefined, title: m.role === "owner" ? "President" : rs.find((r) => r.id === m.role_id)?.name })).sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "owner" ? -1 : 1)),
      };
    })
    .sort((a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name));
}

/** What is wrong with a new organization request, in plain words, or null. */
export function problemWithOrg(d: { name: string; description: string }, app?: Application): string | null {
  const name = d.name.trim();
  if (name.length < 2) return "Give the club or office a name (at least 2 letters).";
  if (name.length > 80) return "That name is a little long. Keep it under 80 characters.";
  if (d.description.trim().length > 300) return "Keep the description under 300 characters.";
  if (app) {
    if (app.purpose.trim().length < 30) return "Tell the coordinator what the club is for, in a couple of sentences.";
    if (app.advisorName.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(app.advisorEmail.trim())) return "A club needs a faculty or staff adviser. Add their name and a valid email.";
    if (app.meeting.trim().length < 3) return "Say where and when the club meets.";
    if (app.contact.trim().length < 3) return "Add a way for the coordinator to reach you.";
  }
  return null;
}

/** Can this club put events on the campus calendar? Circles cannot; they are for hanging out. */
export const canHostEvents = (o: Pick<Org, "kind">) => o.kind !== "circle";

/** Will a new event from this club wait for a coordinator? */
export const eventsNeedApproval = (o: Pick<Org, "kind" | "trusted">) => o.kind !== "official" && !o.trusted;

/** The organizations this person can post events as. */
export const postableOrgs = (orgs: Org[]) => orgs.filter((o) => o.mine && o.status === "active");

type Store = { orgs: RawOrg[]; members: RawMember[]; club: RawClubMember[]; roles: RawRole[]; names: Record<string, string>; ready: boolean };

/* ---------- store ---------- */
const live = !!supabase;
const DEMO_KEY = "orbit-demo-campus-orgs";
const DEMO_ME = "demo-me";
const demoStart = (): Store => ({
  orgs: [
    { id: "o1", name: "Robotics Club", description: "Build nights, competitions and a lot of snacks.", kind: "student", status: "active", created_by: DEMO_ME, trusted: false },
    { id: "o2", name: "Student Life", description: "Events from the Student Life office.", kind: "official", status: "active", created_by: "demo-staff" },
    { id: "o3", name: "Film Society", description: "Weekly screenings on the north lawn.", kind: "student", status: "pending", created_by: "demo-other", created_at: new Date(Date.now() - 3600_000).toISOString(),
      purpose: "A weekly outdoor film night open to every student, with a short talk before each screening and snacks from the student store.", category: "Arts and culture", advisor_name: "Dr. Rivera", advisor_email: "rivera@demo.edu", meeting: "Fridays, 8 PM, north lawn", expected_members: 40, first_event: "Outdoor movie screening on Oct 30", contact: "film@demo.edu" },
  ],
  club: [{ org_id: "o1", user_id: "demo-maya", status: "pending", message: "I built a robot for my high school team and would love to join.", created_at: new Date(Date.now() - 1800_000).toISOString() }, { org_id: "o1", user_id: "demo-riley", status: "member", created_at: new Date(Date.now() - 86400_000).toISOString() }],
  roles: [{ id: "r1", org_id: "o1", name: "Treasurer", permissions: ["announce", "events", "polls"], position: 1 }, { id: "r2", org_id: "o1", name: "Photographer", permissions: [], position: 2 }],
  members: [{ org_id: "o1", user_id: DEMO_ME, role: "owner" }, { org_id: "o1", user_id: "demo-sam", role: "officer", role_id: "r1" }, { org_id: "o3", user_id: "demo-other", role: "owner" }],
  names: { "demo-sam": "Sam", "demo-other": "Jordan", "demo-staff": "Staff", "demo-maya": "Maya", "demo-riley": "Riley" }, ready: true,
});
let state: Store = live ? { orgs: [], members: [], club: [], roles: [], names: {}, ready: false } : (() => { try { const s = localStorage.getItem(DEMO_KEY); if (s) { const saved = JSON.parse(s) as Store; return { ...saved, club: saved.club ?? [], roles: saved.roles ?? [] }; } } catch { /* none saved */ } return demoStart(); })();
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
    const [o0, m0, c, rl] = await Promise.all([
      supabase!.from("campus_orgs").select("id,name,description,about,accent,icon,kind,status,created_by,review_note,trusted,created_at,reviewed_at,purpose,category,advisor_name,advisor_email,meeting,expected_members,first_event,contact").order("name", { ascending: true }).limit(500),
      supabase!.from("campus_org_members").select("org_id,user_id,role,role_id").limit(3000),
      supabase!.from("campus_club_members").select("org_id,user_id,status,message,created_at").limit(5000),
      supabase!.from("campus_org_roles").select("id,org_id,name,permissions,position").limit(2000),
    ]);
    // Before the profile migration is applied the about column is missing: ask for the clubs without it.
    // Before the look migration is applied the accent and icon columns are missing: ask without them first.
    const o1 = o0.error ? await supabase!.from("campus_orgs").select("id,name,description,about,kind,status,created_by,review_note,trusted,created_at,reviewed_at,purpose,category,advisor_name,advisor_email,meeting,expected_members,first_event,contact").order("name", { ascending: true }).limit(500) : o0;
    const o = o1.error ? await supabase!.from("campus_orgs").select("id,name,description,kind,status,created_by,review_note,trusted,created_at,reviewed_at,purpose,category,advisor_name,advisor_email,meeting,expected_members,first_event,contact").order("name", { ascending: true }).limit(500) : o1;
    // Before the roles migration is applied the role_id column and the roles table are missing: fall back to the plain list.
    const m = m0.error ? await supabase!.from("campus_org_members").select("org_id,user_id,role").limit(3000) : m0;
    const roles = rl.error ? [] : ((rl.data ?? []) as RawRole[]);
    // Before the organizations migration is applied the tables are missing: show none, never an error.
    if (o.error || m.error) { if (mine === loadId && who === me) set({ ...state, orgs: [], members: [], club: [], roles: [], ready: true }); return; }
    const members = (m.data ?? []) as RawMember[];
    // Before the join-requests migration is applied this table is missing: the clubs still show, with no members.
    const club = c.error ? [] : ((c.data ?? []) as RawClubMember[]);
    const orgs = (o.data ?? []) as RawOrg[];
    const names = await loadNames([...members.map((x) => x.user_id), ...club.filter((x) => x.status === "pending" || x.status === "member").map((x) => x.user_id), ...orgs.map((x) => x.created_by)]).catch(() => ({}));
    if (mine !== loadId || who !== me) return;
    set({ orgs, members, club, roles, names, ready: true });
  } catch { /* keep what is on screen */ }
}

export function bindCampusOrgs(userId: string) {
  if (!live || who === userId) return;
  unbindCampusOrgs();
  who = userId;
  void reload();
  stop = watchTables(`orbit-orgs-${userId}`, ["campus_orgs", "campus_org_members", "campus_club_members", "campus_org_roles"], () => void reload());
}
export function unbindCampusOrgs() {
  if (!live) return;
  stop?.(); stop = null; who = null; loadId++;
  state = { orgs: [], members: [], club: [], roles: [], names: {}, ready: false };
  subs.forEach((f) => f());
}

const me = () => (live ? who : DEMO_ME);
/** Who is signed in (the demo user in the demo build). */
export const currentUserId = () => me();
export const EMPTY_APP: Application = { purpose: "", category: "", advisorName: "", advisorEmail: "", meeting: "", expectedMembers: null, firstEvent: "", contact: "" };
const fail = (title: string, message: string) => { notice.show({ icon: "alert", title, message }); return message; };

export const orgActions = {
  /** Ask for a club or office to be set up. A coordinator approves it; a coordinator's own request is approved at once. Resolves to a message or null. */
  async request(d: { name: string; description: string; reviewer: boolean; kind?: OrgKind; application?: Application }): Promise<{ error: string | null; status?: OrgStatus; id?: string }> {
    const bad = problemWithOrg(d, d.reviewer || d.kind === "circle" ? undefined : d.application ?? EMPTY_APP);
    if (bad) return { error: bad };
    const a = d.application ?? EMPTY_APP;
    const row = { name: d.name.trim().replace(/\s+/g, " "), description: d.description.trim() };
    const appRow = { purpose: a.purpose.trim(), category: a.category, advisor_name: a.advisorName.trim(), advisor_email: a.advisorEmail.trim(), meeting: a.meeting.trim(), expected_members: a.expectedMembers, first_event: a.firstEvent.trim(), contact: a.contact.trim() };
    if (!live) {
      const id = crypto.randomUUID();
      const kind: OrgKind = d.kind === "circle" ? "circle" : d.reviewer && d.kind === "official" ? "official" : "student";
      const status: OrgStatus = d.reviewer || kind === "circle" ? "active" : "pending";
      set({ ...state, orgs: [...state.orgs, { id, ...row, ...appRow, kind, status, created_by: DEMO_ME, trusted: kind === "official", created_at: new Date().toISOString() }], members: [...state.members, { org_id: id, user_id: DEMO_ME, role: "owner" }] });
      return { error: null, status, id };
    }
    if (!who) return { error: "Sign in first." };
    const { data: member } = await supabase!.from("campus_memberships").select("campus_key").eq("user_id", who).maybeSingle();
    const { data, error } = await supabase!.from("campus_orgs").insert({ ...row, ...(d.kind === "circle" ? { category: a.category, kind: "circle" } : { ...appRow, ...(d.reviewer && d.kind ? { kind: d.kind } : {}) }), created_by: who, campus_key: (member as { campus_key: string } | null)?.campus_key }).select("id,status").single();
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
  /** Ask to join a club. An officer answers. */
  async requestJoin(orgId: string, message: string): Promise<string | null> {
    const msg = message.trim().slice(0, 200);
    if (!live) {
      if (state.club.some((c) => c.org_id === orgId && c.user_id === DEMO_ME && c.status !== "declined")) return null;
      set({ ...state, club: [...state.club.filter((c) => !(c.org_id === orgId && c.user_id === DEMO_ME)), { org_id: orgId, user_id: DEMO_ME, status: state.orgs.find((o) => o.id === orgId)?.kind === "circle" ? "member" : "pending", message: msg, created_at: new Date().toISOString() }] });
      return null;
    }
    const { error } = await supabase!.rpc("request_join_club", { org: orgId, msg });
    if (error) return fail("Could not send that", error.message);
    await reload();
    return null;
  },
  /** An officer (or a coordinator) lets someone in, or turns the request down. */
  async decideJoin(orgId: string, userId: string, approve: boolean): Promise<string | null> {
    const before = state;
    set({ ...state, club: state.club.map((c) => (c.org_id === orgId && c.user_id === userId ? { ...c, status: approve ? "member" : "declined" } : c)) });
    if (!live) return null;
    const { error } = await supabase!.rpc("decide_join_request", { org: orgId, member: userId, approve });
    if (error) { set(before); return fail("That did not save", error.message); }
    return null;
  },
  /** Leave a club, or take back a request. */
  async leaveClub(orgId: string): Promise<string | null> {
    const before = state;
    set({ ...state, club: state.club.filter((c) => !(c.org_id === orgId && c.user_id === me())) });
    if (!live) return null;
    const { error } = await supabase!.rpc("leave_club", { org: orgId });
    if (error) { set(before); return fail("That did not work", error.message); }
    return null;
  },
  async approve(id: string) { return decide(id, "active"); },
  async decline(id: string, note: string) { return decide(id, "rejected", note.trim().slice(0, 200) || undefined); },
  async setPaused(id: string, paused: boolean) { return decide(id, paused ? "paused" : "active"); },
  /** The president edits the club page: the line under the name, the About text, the category and when and where it meets. */
  async updateProfile(id: string, d: { description: string; about: string; category: string; meeting: string }): Promise<string | null> {
    const row = { description: d.description.trim().slice(0, 300), about: d.about.trim().slice(0, 1500), category: d.category, meeting: d.meeting.trim().slice(0, 160) };
    if (!live) {
      set({ ...state, orgs: state.orgs.map((o) => (o.id === id ? { ...o, description: row.description, about: row.about, category: row.category, meeting: row.meeting } : o)) });
      return null;
    }
    const before = state;
    set({ ...state, orgs: state.orgs.map((o) => (o.id === id ? { ...o, ...row } : o)) });
    const { error } = await supabase!.from("campus_orgs").update(row).eq("id", id);
    if (error) { set(before); return /about/.test(error.message) ? "Editing the About text needs the latest database update. Try again soon." : error.message; }
    return null;
  },
  /** The president picks the club's colour (a hue, or null for the default) and icon (one emoji, or empty for its first letter). */
  async updateLook(id: string, d: { accent: number | null; icon: string }): Promise<string | null> {
    const row = { accent: d.accent, icon: Array.from(d.icon.trim()).slice(0, 2).join("") };
    const before = state;
    set({ ...state, orgs: state.orgs.map((o) => (o.id === id ? { ...o, accent: row.accent ?? undefined, icon: row.icon } : o)) });
    if (!live) return null;
    const { error } = await supabase!.from("campus_orgs").update(row).eq("id", id);
    if (error) { set(before); return /accent|icon/.test(error.message) ? "Choosing a colour needs the latest database update. Try again soon." : error.message; }
    return null;
  },
  /** Make a role, or change one (name and what it may do). Resolves to an error message or null. */
  async saveRole(orgId: string, roleId: string | null, name: string, perms: Perm[]): Promise<string | null> {
    const nm = name.trim();
    if (!nm || nm.length > 30) return "Give the role a name (up to 30 characters).";
    if (!live) {
      if (state.roles.some((r) => r.org_id === orgId && r.id !== roleId && r.name.toLowerCase() === nm.toLowerCase())) return "There is already a role with that name.";
      const next = roleId
        ? state.roles.map((r) => (r.id === roleId ? { ...r, name: nm, permissions: perms } : r))
        : [...state.roles, { id: crypto.randomUUID(), org_id: orgId, name: nm, permissions: perms, position: state.roles.length + 1 }];
      set({ ...state, roles: next });
      return null;
    }
    const { error } = await supabase!.rpc("save_org_role", { org: orgId, role_id: roleId, role_name: nm, perms });
    if (error) return error.message;
    await reload();
    return null;
  },
  async deleteRole(roleId: string): Promise<string | null> {
    if (!live) {
      if (state.members.some((m) => m.role_id === roleId)) return "Move the people in this role to another role first.";
      set({ ...state, roles: state.roles.filter((r) => r.id !== roleId) });
      return null;
    }
    const { error } = await supabase!.rpc("delete_org_role", { role: roleId });
    if (error) return error.message;
    await reload();
    return null;
  },
  /** Give someone a role (adding them to the team if they are not on it yet). */
  async setMemberRole(orgId: string, userId: string, roleId: string): Promise<string | null> {
    if (!live) {
      const has = state.members.some((m) => m.org_id === orgId && m.user_id === userId);
      set({ ...state, members: has ? state.members.map((m) => (m.org_id === orgId && m.user_id === userId && m.role !== "owner" ? { ...m, role_id: roleId } : m)) : [...state.members, { org_id: orgId, user_id: userId, role: "officer", role_id: roleId }] });
      return null;
    }
    const { error } = await supabase!.rpc("set_member_role", { org: orgId, member: userId, role: roleId });
    if (error) return fail("That did not work", error.message);
    await reload();
    return null;
  },
  /** An owner adds an officer by username. */
  async addMember(orgId: string, username: string, roleId?: string): Promise<string | null> {
    const found = await findByUsername(username);
    if (!found) return `Nobody on your campus has the username @${username.replace(/^@/, "")}.`;
    if (!live) {
      if (state.members.some((m) => m.org_id === orgId && m.user_id === found.id)) return null;
      set({ ...state, members: [...state.members, { org_id: orgId, user_id: found.id, role: "officer", ...(roleId ? { role_id: roleId } : {}) }], names: { ...state.names, [found.id]: found.name } });
      return null;
    }
    const { error } = roleId ? await supabase!.rpc("set_member_role", { org: orgId, member: found.id, role: roleId }) : await supabase!.rpc("add_org_member", { org: orgId, member: found.id });
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
  const orgs = buildOrgs(s.orgs, s.members, me() ?? "", s.names, s.club, s.roles);
  return { orgs, mine: orgs.filter((o) => o.mine), postable: postableOrgs(orgs), ready: s.ready };
}

/** The ids of the organizations this person is an officer of. */
export function useMyOrgIds(): Set<string> {
  const s = useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
  const id = me();
  return new Set(s.members.filter((m) => m.user_id === id).map((m) => m.org_id));
}

/** The club's colour: the one its president chose, or one from its name. */
export const orgHue = (o: { name: string; accent?: number }): number => (typeof o.accent === "number" ? calmHue(o.accent) : hueFor(o.name));
