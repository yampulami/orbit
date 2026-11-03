// Reads each campus's public faculty and staff directory, works out who runs student life (see _shared/staffDirectory.ts), stores that list, gives the
// roles to people already signed up with a verified email on it, and takes the roles away from people who have left the directory. See STAFF-ACCESS.md.
// Called by the schedule with the header x-cron-secret (the same EVENTS_CRON_SECRET as the events sync). Nothing is called from the app.
import { createClient } from "npm:@supabase/supabase-js@2";
import { labelFor, parseDirectoryPage, pickAccess, planRevocations, type DirectoryPerson, type StoredHost } from "../_shared/staffDirectory.ts";
import { problemWithSourceUrl } from "../_shared/eventSources.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const MAX_PAGES = 80;
const MAX_BYTES = 3_000_000;

type Source = { campus_key: string; url: string; domains: string[]; offices: string[]; max_coordinators: number; max_staff: number; people_count: number };

/** Directory pages are numbered: the base address, then /page/2/, /page/3/ ... until a page has nobody on it. */
async function readDirectory(base: string): Promise<DirectoryPerson[]> {
  const people: DirectoryPerson[] = [];
  const root = base.replace(/\/page\/\d+\/?$/, "").replace(/\/?$/, "/");
  for (let n = 1; n <= MAX_PAGES; n++) {
    const url = n === 1 ? root : `${root}page/${n}/`;
    if (problemWithSourceUrl(url)) throw new Error("That directory address is not allowed.");
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { "user-agent": "OrbitDirectoryReader/1.0 (campus staff access)" } });
    if (!res.ok) { if (n === 1) throw new Error(`The directory answered with an error (${res.status}).`); break; }
    const html = await res.text();
    if (html.length > MAX_BYTES) throw new Error("A directory page is too big to read.");
    const found = parseDirectoryPage(html);
    if (!found.length) break;
    people.push(...found);
    await new Promise((r) => setTimeout(r, 250)); // be gentle with the school's website
  }
  return people;
}

async function syncOne(s: Source) {
  const stamp = (note: string, extra: Record<string, unknown> = {}) => db.from("campus_directory_sources").update({ synced_at: new Date().toISOString(), note: note.slice(0, 300), ...extra }).eq("campus_key", s.campus_key);
  try {
    const people = await readDirectory(s.url);
    const access = pickAccess(people, { offices: s.offices, domains: s.domains, maxCoordinators: s.max_coordinators, maxStaff: s.max_staff });

    // Replace the list for this campus (only when the read found people at all).
    if (people.length > 0) {
      await db.from("campus_directory_access").delete().eq("campus_key", s.campus_key);
      if (access.length) {
        const { error } = await db.from("campus_directory_access").insert(access.map((a) => ({ campus_key: s.campus_key, email: a.email, name: a.name, title: labelFor(a), department: a.department, role: a.role, score: a.score })));
        if (error) throw new Error(error.message);
      }
    }

    // Take roles away from people the directory gave them to and who are no longer on the list.
    const { data: given } = await db.from("campus_hosts").select("user_id,directory_email,role").eq("campus_key", s.campus_key).eq("source", "directory");
    const plan = planRevocations((given ?? []) as StoredHost[], access, people.length, s.people_count);
    if (plan.revoke.length) await db.from("campus_hosts").delete().in("user_id", plan.revoke).eq("source", "directory");

    // Give the roles to people who already have an account with a verified email on the list.
    const { data: granted } = await db.rpc("grant_directory_access", { ck: s.campus_key });

    const roles = access.map((a) => `${a.name} (${a.role})`).join(", ");
    await stamp(`${people.length} people read. Access for: ${roles || "nobody found"}. Given now: ${granted ?? 0}, taken away: ${plan.revoke.length}.`, people.length > 0 ? { people_count: people.length } : {});
    return { campus: s.campus_key, ok: true, people: people.length, access: access.map((a) => ({ name: a.name, role: a.role, title: a.title })), granted: granted ?? 0, revoked: plan.revoke.length };
  } catch (e) {
    await stamp((e as Error).message || "Could not read the directory.");
    return { campus: s.campus_key, ok: false, error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  const secret = env("EVENTS_CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "Not allowed." }, 401);
  try {
    const { data, error } = await db.from("campus_directory_sources").select("campus_key,url,domains,offices,max_coordinators,max_staff,people_count");
    if (error) throw new Error(error.message);
    const results = [];
    for (const s of (data ?? []) as Source[]) results.push(await syncOne(s));
    return json({ results });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
