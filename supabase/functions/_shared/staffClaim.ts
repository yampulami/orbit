// Lets someone at ANY school prove they run student life there, with no setup per school. They give the address of a page on their school's own website
// (a staff directory entry or an office page) that shows their name, title and email. The proof has to hold together:
//   - they are signed in with a CONFIRMED email on the school's domain (they own the mailbox)
//   - the page is on that same domain's main website, not a student page, blog or calendar
//   - their exact email address is on the page, in an entry that names nobody else's address
//   - the title in that entry carries real authority (Dean, Director ... see staffDirectory.ts) and belongs to a student-life office
// Pure functions only (no network, no database), so the verify function and the tests run the same code.
import { titleScore } from "./staffDirectory.ts";

export const FREE_MAIL = new Set(["gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "pm.me", "gmx.com", "mail.com", "yandex.com", "qq.com", "163.com", "zoho.com"]);

/** Words that mark an office that runs student life. A school can use its own list; this is the default for any school. */
export const DEFAULT_OFFICES = ["student life", "student affairs", "student engagement", "student activities", "campus life", "dean of students", "student involvement", "student development", "student services", "student leadership", "residence life"];

const EMAIL = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi;
const emailsIn = (s: string) => new Set((s.match(EMAIL) ?? []).map((e) => e.toLowerCase()));
const domainOf = (email: string) => email.split("@")[1]?.toLowerCase() ?? "";

/* ---------- the address ---------- */

/** The websites a school's staff pages may live on, from the staff member's email domain: the domain itself, www, or the school's main domain when the
 *  email uses a department subdomain ("cs.school.edu" gives "school.edu"). */
export function allowedHosts(emailDomain: string): string[] {
  const d = emailDomain.toLowerCase();
  const parts = d.split(".");
  const parent = parts.length >= 3 ? parts.slice(1).join(".") : "";
  return [...new Set([d, `www.${d}`, ...(parent ? [parent, `www.${parent}`] : [])])];
}

const RISKY_PATH = /(^|\/)(~[^/]*|students?|blogs?|news|forums?|calendar|events?|uploads|wp-content|sites|pages-by)(\/|$)/i;

/** Is this address acceptable as proof? Returns a reason in words, or null. */
export function problemWithProofUrl(raw: string, emailDomain: string): string | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return "That does not look like a web address."; }
  if (u.protocol !== "https:") return "Use an address that starts with https://.";
  if (u.username || u.password || (u.port && u.port !== "443")) return "Use a plain web address, without a username or port.";
  if (!allowedHosts(emailDomain).includes(u.hostname.toLowerCase())) return `The page has to be on your school's own website, the same one as your school email (for example https://www.${emailDomain.split(".").slice(-2).join(".")}/...).`;
  if (RISKY_PATH.test(u.pathname)) return "That looks like a news, blog, events or student page. Use your staff directory entry or your office's page.";
  if (raw.length > 400) return "That address is too long.";
  return null;
}

/* ---------- finding the person on the page ---------- */

const BLOCK = new Set(["tr", "li", "article", "section", "div", "p", "td", "dd", "dl", "address", "blockquote", "figure", "tbody", "table", "main", "body"]);
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ndash: "–", mdash: "—" };
const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => (e[0] === "#" ? (() => { try { return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))); } catch { return ""; } })() : ENTITIES[e.toLowerCase()] ?? m));

type El = { start: number; end: number; tag: string };

/** The block-level elements of a page as character ranges, found with a simple tag stack. */
function elements(html: string): El[] {
  const out: El[] = [];
  const stack: El[] = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[2].toLowerCase();
    if (!BLOCK.has(tag)) continue;
    if (!m[1] && !m[3]) { const el = { start: m.index, end: html.length, tag }; stack.push(el); out.push(el); }
    else if (m[1]) {
      const i = stack.map((e) => e.tag).lastIndexOf(tag);
      if (i >= 0) { const closed = stack.splice(i); for (const c of closed) c.end = c === closed[0] ? re.lastIndex : Math.min(c.end, m.index); }
    }
  }
  return out;
}

/** The short lines of an entry: each piece of text between tags, one per line. Long prose (a biography) is left out, because titles are short. */
function shortLines(html: string): string[] {
  return decode(html.replace(/<(br|\/p|\/div|\/li|\/tr|\/td|\/h[1-6]|\/dd|\/dt|\/address)\b[^>]*>/gi, "\n").replace(/<[^>]+>/g, "\n"))
    .split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l && l.length <= 100);
}

export type Evidence = {
  found: boolean;
  /** Another person's address sits in the same smallest entry, so it is unclear whose title it is. */
  ambiguous: boolean;
  title: string;
  score: number;
  officeMatched: boolean;
  /** Other addresses on the same domain elsewhere on the page: a directory has many, a personal page has none. */
  others: number;
};
const NONE: Evidence = { found: false, ambiguous: false, title: "", score: 0, officeMatched: false, others: 0 };

/** Pure: where this person's email is on the page, the entry it belongs to, and what that entry's title is worth. */
export function findEvidence(html: string, email: string, offices: string[] = DEFAULT_OFFICES): Evidence {
  const clean = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, "");
  const me = email.trim().toLowerCase();
  const at = clean.toLowerCase().indexOf(me);
  if (at < 0) return NONE;
  const domain = domainOf(me);
  const others = [...emailsIn(clean)].filter((e) => e !== me && domainOf(e) === domain).length;

  // The entry: climb from the smallest block around the address while it still names only this person's address.
  const chain = elements(clean).filter((e) => e.start <= at && e.end > at).sort((a, b) => (a.end - a.start) - (b.end - b.start));
  let best: El | null = null;
  let ambiguous = false;
  for (const el of chain) {
    const mine = emailsIn(clean.slice(el.start, el.end));
    if ([...mine].some((e) => e !== me)) { if (!best) ambiguous = true; break; }
    if (el.end - el.start > 20000) break;
    best = el;
  }
  if (!best) return { ...NONE, found: true, ambiguous: true, others };
  const lines = shortLines(clean.slice(best.start, best.end)).filter((l) => !emailsIn(l).size);
  let title = "", score = 0;
  for (const l of lines) { const s = titleScore(l); if (s > score) { score = s; title = l; } }
  const hay = lines.join(" | ").toLowerCase();
  return { found: true, ambiguous, title, score, officeMatched: offices.some((o) => hay.includes(o.toLowerCase())), others };
}

/* ---------- the decision ---------- */

export type Decision = { ok: true; role: "coordinator" | "staff"; title: string; score: number } | { ok: false; code: "not_found" | "ambiguous" | "weak_title" | "wrong_office" | "not_official"; reason: string };

/** Pure: what the evidence is worth. Coordinators need a leadership title (score 80 or more), staff a senior one (60 or more); either must be in a student-life office,
 *  and the page must look like a directory or an office page, not a page about one person. */
export function decideClaim(ev: Evidence, ctx: { path: string; coordinatorMin?: number; staffMin?: number }): Decision {
  const { coordinatorMin = 80, staffMin = 60 } = ctx;
  if (!ev.found) return { ok: false, code: "not_found", reason: "We could not find your school email address on that page. Use a page that lists your name, title and email." };
  if (ev.ambiguous) return { ok: false, code: "ambiguous", reason: "That page lists other people's email addresses right next to yours, so we cannot tell which title is yours. Use your own entry's page." };
  if (ev.score < staffMin) return { ok: false, code: "weak_title", reason: ev.title ? `We found you, but "${ev.title}" is not a leadership title (Dean, Director or similar).` : "We found your email, but no title next to it." };
  if (!ev.officeMatched) return { ok: false, code: "wrong_office", reason: `We found "${ev.title}", but it does not mention a student-life office (student life, student affairs, student engagement, dean of students and similar).` };
  const officialPath = /staff|directory|faculty|leadership|administration|(^|\/)(team|our-team|contact|offices?|people)(\/|$)/i.test(ctx.path);
  if (ev.others < 2 && !officialPath) return { ok: false, code: "not_official", reason: "That page does not look like a staff directory or an office page. Use your entry in the staff directory." };
  return { ok: true, role: ev.score >= coordinatorMin ? "coordinator" : "staff", title: ev.title.slice(0, 80), score: ev.score };
}

/** Can this email be used to claim a role at all? Returns a reason in words, or null. */
export function problemWithClaimEmail(email: string): string | null {
  const d = domainOf(email.trim().toLowerCase());
  if (!d.includes(".")) return "Sign in with your school email address.";
  if (FREE_MAIL.has(d)) return "You are signed in with a personal email address. Sign in with your school email to verify your role.";
  return null;
}
