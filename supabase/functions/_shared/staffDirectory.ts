// Works out who runs a campus from its public faculty and staff directory. Pure functions only (no network, no database), so the sync function and
// the tests in web/ run the same code.
//   1. read the directory table (Name, Department, Title, Email)
//   2. score every title for how much authority it carries ("Dean of Student Life" is high, "Administrative Assistant" is low)
//   3. keep the people in the offices that run student life, and pick who gets which role: the top few become coordinators, the next staff
//   4. later, a signed-in person whose *verified* email is in that list is given the role (see claim_staff_access in the database)

export type DirectoryPerson = { name: string; department: string; title: string; email: string };
export type Access = { email: string; name: string; department: string; title: string; score: number; role: "coordinator" | "staff" };
export type DirectoryConfig = {
  /** Words that mark an office that runs student life, matched against the department and the title ("student life", "student engagement"). */
  offices: string[];
  /** Email domains that count for this campus ("caldwell.edu"). */
  domains: string[];
  maxCoordinators?: number;
  maxStaff?: number;
  /** Lowest score for each role. */
  coordinatorMin?: number;
  staffMin?: number;
};

/* ---------- reading the page ---------- */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ndash: "–", mdash: "—" };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") { const c = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1)); try { return String.fromCodePoint(c); } catch { return ""; } }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** One page of the directory: every table row with a name, department, title and email. */
export function parseDirectoryPage(html: string): DirectoryPerson[] {
  const out: DirectoryPerson[] = [];
  for (const row of html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
    const cell = (label: string) => row.match(new RegExp(`<td[^>]*data-label="${label}"[^>]*>([\\s\\S]*?)</td>`, "i"))?.[1] ?? "";
    // The address comes only from the Email column: a biography in the same row may mention other addresses.
    const email = cell("Email").match(/mailto:([^"'?\s]+)/i)?.[1]?.trim().toLowerCase() ?? "";
    const name = text(row.match(/<td[^>]*data-label="Name"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "");
    const title = text(cell("Title")), department = text(cell("Department"));
    if (name && email.includes("@") && title) out.push({ name, department, title, email });
  }
  return out;
}

/** "Chatman, Jasmine" into "Jasmine Chatman". */
export const displayName = (n: string) => { const m = n.match(/^([^,]+),\s*(.+)$/); return m ? `${m[2].trim()} ${m[1].trim()}` : n; };

/* ---------- scoring a title ---------- */

const BASE: [RegExp, number][] = [
  [/\bdean\b/, 90],
  [/\bdirector\b/, 85],
  [/\bmanager\b/, 55],
  [/\badvis[eo]r\b/, 40],
  [/\bcoordinator\b/, 45],
  [/\bspecialist\b/, 35],
];

/** How much authority one clause of a title carries, 0 to 100. Words before the role matter: "Associate Dean" is below "Dean", "Assistant Athletic
 *  Director" is below "Director". A clause about being someone's assistant carries almost none. */
function clauseScore(raw: string): number {
  const c = raw.toLowerCase().trim();
  if (!c) return 0;
  if (/\bassistant to\b|\badministrative assistant\b|\bsecretary\b|\breceptionist\b/.test(c)) return 10;
  if (/\bassistant vice president\b/.test(c)) return 95;
  if (/\bassociate vice president\b/.test(c)) return 92;
  if (/\bvice president\b|\bprovost\b|\bchancellor\b/.test(c)) return 100;
  if (/\bpresident\b/.test(c)) return 100;
  for (const [re, base] of BASE) {
    const m = re.exec(c);
    if (!m) continue;
    const before = c.slice(0, m.index);
    if (/dean|director/.test(m[0])) {
      if (/\bexecutive\b/.test(before)) return base + 3;
      if (/\bdeputy\b/.test(before)) return base - 5;
      if (/\bassociate\b/.test(before)) return base - 15;
      if (/\bassistant\b/.test(before)) return base - 25;
    }
    return base;
  }
  return 0;
}

/** The authority of a whole title ("Assistant Vice President, Director of Athletics"): its strongest part. */
export const titleScore = (title: string): number => Math.max(0, ...title.split(/[,;&\/]|\band\b|\|/i).map(clauseScore));

/* ---------- choosing who gets access ---------- */

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ");
const inOffices = (p: DirectoryPerson, offices: string[]) => {
  const hay = norm(`${p.department} | ${p.title}`);
  return offices.some((o) => hay.includes(norm(o)));
};
const domainOf = (email: string) => email.split("@")[1]?.toLowerCase() ?? "";

/** Pure: from everyone in the directory, who should have which role. The strongest titles in the student-life offices become coordinators (up to a
 *  few), the next become staff, and everyone else gets nothing. One entry per email address. */
export function pickAccess(people: DirectoryPerson[], cfg: DirectoryConfig): Access[] {
  const { offices, domains, maxCoordinators = 2, maxStaff = 5, coordinatorMin = 80, staffMin = 60 } = cfg;
  const allowed = new Set(domains.map((d) => d.toLowerCase()));
  const best = new Map<string, Access>();
  for (const p of people) {
    const email = p.email.trim().toLowerCase();
    if (!email.includes("@") || !allowed.has(domainOf(email)) || !inOffices(p, offices)) continue;
    const score = titleScore(p.title);
    if (score < staffMin) continue;
    const have = best.get(email);
    if (!have || score > have.score) best.set(email, { email, name: displayName(p.name), department: p.department, title: p.title, score, role: score >= coordinatorMin ? "coordinator" : "staff" });
  }
  const ranked = [...best.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const coordinators = ranked.filter((a) => a.role === "coordinator").slice(0, maxCoordinators);
  // Someone who scored as a coordinator but did not fit under the cap is staff.
  const staff = ranked.filter((a) => !coordinators.includes(a)).map((a) => ({ ...a, role: "staff" as const })).slice(0, maxStaff);
  return [...coordinators, ...staff];
}

/** What to show on the events a person posts: their title, kept short. */
export const labelFor = (a: Pick<Access, "title" | "department">) => (a.title.length <= 80 ? a.title : a.title.slice(0, 77) + "…");

/* ---------- deciding what to change ---------- */

export type StoredHost = { user_id: string; directory_email: string | null; role: string };
export type RevokePlan = { revoke: string[] };

/** Pure: who loses a role they were given from the directory. Only people the directory gave access to are ever touched, and nobody loses access when the
 *  directory looks broken (it returned far fewer people than last time). */
export function planRevocations(hosts: StoredHost[], current: Access[], peopleNow: number, peopleBefore: number): RevokePlan {
  if (peopleNow === 0 || (peopleBefore > 20 && peopleNow < peopleBefore / 2)) return { revoke: [] };
  const keep = new Set(current.map((a) => a.email.toLowerCase()));
  return { revoke: hosts.filter((h) => h.directory_email && !keep.has(h.directory_email.toLowerCase())).map((h) => h.user_id) };
}
