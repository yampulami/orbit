/** What people can do inside a club. The owner can do everything; others can do what their role ticks. This mirrors the database (org_perms), which
 *  is what actually enforces it; the screen uses it to show only the buttons that will work. */
export type Perm = "announce" | "events" | "members" | "roles" | "tasks" | "polls" | "moderate" | "channels";

export const PERMS: { key: Perm; label: string; help: string }[] = [
  { key: "announce", label: "Post announcements", help: "Announcements show to the whole campus and notify the club." },
  { key: "events", label: "Create events", help: "Post campus events for the club (a coordinator may still review them)." },
  { key: "polls", label: "Run polls", help: "Ask the club a question and collect votes." },
  { key: "members", label: "Manage members", help: "Answer join requests and welcome people in." },
  { key: "roles", label: "Manage roles", help: "Give people titles and change what a role can do." },
  { key: "moderate", label: "Moderate", help: "Remove posts, comments and chat messages that do not belong." },
  { key: "channels", label: "Manage channels", help: "Add and remove the club's chat channels." },
  { key: "tasks", label: "Assign tasks", help: "Hand out jobs to people in the club and track them on the dashboard." },
];
export const ALL_PERMS: Perm[] = PERMS.map((p) => p.key);
/** An officer from before roles existed (no role yet) keeps these. */
export const LEGACY_OFFICER_PERMS: Perm[] = ["announce", "events", "polls"];

export type RawRole = { id: string; org_id: string; name: string; permissions: string[]; position?: number };
export type Role = { id: string; name: string; permissions: Perm[]; people: number; position: number };

const isPerm = (p: string): p is Perm => (ALL_PERMS as string[]).includes(p);

/** Pure: what one person in a club may do. */
export function permsOf(member: { role: "owner" | "officer"; role_id?: string | null } | undefined, roles: Pick<RawRole, "id" | "permissions">[]): Perm[] {
  if (!member) return [];
  if (member.role === "owner") return [...ALL_PERMS];
  if (member.role_id) return (roles.find((r) => r.id === member.role_id)?.permissions ?? []).filter(isPerm);
  return [...LEGACY_OFFICER_PERMS];
}

/** The permissions the owner alone may hand out. A role manager cannot make more role managers. */
export const OWNER_ONLY: Perm[] = ["roles"];

/* ---------- rank ----------
 * A club has an order: the president, then its roles from the top of the list down, then people on the team with no role, then members.
 * Lower is more powerful. This mirrors the database (org_rank), which is what really enforces it: you can only act on people, and hand out
 * roles, that rank below you. A coordinator outranks everyone (-1). */
export const RANK = { coordinator: -1, president: 0, role: 10, team: 5000, member: 9000, none: 10000 } as const;

/** Pure: where one person stands. `position` of their role comes from the roles list. */
export function rankOf(member: { role: "owner" | "officer"; role_id?: string | null } | undefined, roles: { id: string; position?: number }[], isMember = false): number {
  if (member) {
    if (member.role === "owner") return RANK.president;
    if (member.role_id) return RANK.role + (roles.find((r) => r.id === member.role_id)?.position ?? 4000);
    return RANK.team;
  }
  return isMember ? RANK.member : RANK.none;
}
export const roleRank = (role: { position?: number }) => RANK.role + (role.position ?? 0);

/** May someone of rank `mine` act on someone of rank `theirs` (change their role, remove them)? Never on your own rank or above. */
export const outranks = (mine: number, theirs: number) => mine < 0 || theirs > mine;

/** The roles `mine` may give out: only those below their own rank (the president and a coordinator may give any). */
export const rolesBelow = <T extends { position?: number }>(mine: number, roles: T[]): T[] => roles.filter((r) => mine <= 0 || roleRank(r) > mine);

/** Plain words for a rank, for the list of people. */
export const rankLabel = (rank: number, roleName?: string) => (rank === RANK.president ? "President" : rank === RANK.member ? "Member" : roleName ?? "Team");
