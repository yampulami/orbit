// Reads each organization's events page (or calendar feed) and keeps its campus events in step with it. See EVENT-SOURCES.md.
// Two ways to call it:
//   - the schedule, with the header x-cron-secret: syncs every organization that has an events address
//   - the app, signed in as an organization's owner or an officer who may post events: body {"org": "<id>"} syncs just that one ("Read it now")
// Secrets: EVENTS_CRON_SECRET (you choose it). SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase itself.
import { createClient } from "npm:@supabase/supabase-js@2";
import { planSync, problemWithSourceUrl, readSource, type StoredEvent } from "../_shared/eventSources.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const MAX_BYTES = 3_000_000;
const CAMPUS_ZONE = "America/New_York";
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-cron-secret", "access-control-allow-methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

type Org = { id: string; name: string; campus_key: string; created_by: string; events_url: string; kind: string; trusted: boolean };
type Result = { org: string; ok: boolean; added: number; changed: number; canceled: number; hidden: number; restored: number; note: string };

/** Fetch a public web page, by hand, so each redirect is checked too and the size is capped. */
async function download(url: string): Promise<{ body: string; type: string }> {
  let at = url;
  for (let hop = 0; hop < 4; hop++) {
    const bad = problemWithSourceUrl(at);
    if (bad) throw new Error(bad);
    const res = await fetch(at, { redirect: "manual", signal: AbortSignal.timeout(12_000), headers: { "user-agent": "OrbitEventsReader/1.0 (campus events)", accept: "text/calendar, text/html;q=0.9, */*;q=0.5" } });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) { at = new URL(res.headers.get("location")!, at).toString(); continue; }
    if (!res.ok) throw new Error(`The page answered with an error (${res.status}).`);
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error("That page is too big to read."); }
      chunks.push(value);
    }
    const all = new Uint8Array(size);
    let o = 0;
    for (const c of chunks) { all.set(c, o); o += c.length; }
    return { body: new TextDecoder("utf-8").decode(all), type: res.headers.get("content-type") ?? "" };
  }
  throw new Error("The address sends you around in circles.");
}

async function syncOne(org: Org): Promise<Result> {
  const r: Result = { org: org.name, ok: false, added: 0, changed: 0, canceled: 0, hidden: 0, restored: 0, note: "" };
  const finish = async (note: string) => {
    r.note = note;
    await db.from("campus_orgs").update({ events_synced_at: new Date().toISOString(), events_sync_note: note.slice(0, 300) }).eq("id", org.id);
    return r;
  };
  try {
    const { body, type } = await download(org.events_url);
    const now = new Date();
    const found = readSource(body, type, now, CAMPUS_ZONE, org.events_url);
    if (!found.length) return await finish("No events found on that page. If it is a calendar, use its public iCal address.");
    const { data, error } = await db.from("campus_events").select("id,external_key,title,description,place_name,starts_at,ends_at,canceled_at,status").eq("org_id", org.id).not("external_key", "is", null).limit(2000);
    if (error) throw new Error(error.message);
    const plan = planSync(found, (data ?? []) as StoredEvent[], now);

    if (plan.add.length) {
      const { error: e } = await db.from("campus_events").insert(plan.add.map((f) => ({
        campus_key: org.campus_key, host_id: org.created_by, org_id: org.id, host_label: org.name, title: f.title, description: f.description, place_name: f.place,
        starts_at: f.startsAt, ends_at: f.endsAt ?? null, canceled_at: f.canceled ? now.toISOString() : null, external_key: f.key, source_url: org.events_url,
      })));
      if (e) throw new Error(e.message);
      r.added = plan.add.length;
      // The insert trigger clears canceled_at, so mark the ones that arrive already cancelled.
      const cancelled = plan.add.filter((f) => f.canceled).map((f) => f.key);
      if (cancelled.length) await db.from("campus_events").update({ canceled_at: now.toISOString() }).eq("org_id", org.id).in("external_key", cancelled);
    }
    for (const c of plan.change) { const { error: e } = await db.from("campus_events").update(c.patch).eq("id", c.id); if (e) throw new Error(e.message); r.changed++; }
    if (plan.cancel.length) { const { error: e } = await db.from("campus_events").update({ canceled_at: now.toISOString() }).in("id", plan.cancel); if (e) throw new Error(e.message); r.canceled = plan.cancel.length; }
    if (plan.hide.length) { const { error: e } = await db.from("campus_events").update({ status: "removed" }).in("id", plan.hide); if (e) throw new Error(e.message); r.hidden = plan.hide.length; }
    // An event that comes back goes where a new one would: live for an official or trusted organization, otherwise waiting for a coordinator.
    if (plan.restore.length) { const { error: e } = await db.from("campus_events").update({ status: org.kind === "official" || org.trusted ? "published" : "pending" }).in("id", plan.restore); if (e) throw new Error(e.message); r.restored = plan.restore.length; }
    r.ok = true;
    const bits = [r.added && `${r.added} new`, r.changed && `${r.changed} updated`, r.canceled && `${r.canceled} cancelled`, r.hidden && `${r.hidden} taken down`, r.restored && `${r.restored} back`].filter(Boolean);
    return await finish(bits.length ? `${found.length} events on the page: ${bits.join(", ")}.` : `${found.length} events on the page, all up to date.`);
  } catch (e) {
    return await finish((e as Error).message || "Could not read that page.");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  try {
    const secret = env("EVENTS_CRON_SECRET");
    const body = (await req.json().catch(() => ({}))) as { org?: string };
    let orgs: Org[];
    if (secret && req.headers.get("x-cron-secret") === secret) {
      const q = db.from("campus_orgs").select("id,name,campus_key,created_by,events_url,kind,trusted").eq("status", "active").not("events_url", "is", null);
      const { data, error } = await (body.org ? q.eq("id", body.org) : q);
      if (error) throw new Error(error.message);
      orgs = (data ?? []) as Org[];
    } else {
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: u } = token ? await db.auth.getUser(token) : { data: { user: null } };
      if (!u.user || !body.org) return json({ error: "Not allowed." }, 401);
      const { data: perms, error } = await db.rpc("org_perms", { org: body.org, uid: u.user.id });
      if (error || !(perms as string[] | null)?.includes("events")) return json({ error: "Only someone who can post this club's events can do that." }, 403);
      const { data } = await db.from("campus_orgs").select("id,name,campus_key,created_by,events_url,kind,trusted").eq("id", body.org).eq("status", "active").not("events_url", "is", null).maybeSingle();
      // A person can read a page at most every two minutes, so the button cannot be used to hammer a school's website.
      const last = data ? (await db.from("campus_orgs").select("events_synced_at").eq("id", body.org).maybeSingle()).data?.events_synced_at : null;
      if (last && Date.now() - new Date(last).getTime() < 120_000) return json({ error: "That page was just read. Give it a couple of minutes." }, 429);
      orgs = data ? [data as Org] : [];
    }
    const results: Result[] = [];
    for (const o of orgs) results.push(await syncOne(o));
    return json({ results });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
