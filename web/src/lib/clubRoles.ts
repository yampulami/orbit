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
export type Role = { id: string; name: string; permissions: Perm[]; people: number };

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
