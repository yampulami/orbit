// Someone at any school says they run student life and points at a page on their school's own website that shows it. This reads that page and decides,
// using the rules in _shared/staffClaim.ts. A proof that holds gives them the role at once and tells the campus's coordinators; one that does not is kept
// as a denied attempt (so the reason can be shown, and tries can be limited). Called from the app, signed in. See STAFF-ACCESS.md.
import { createClient } from "npm:@supabase/supabase-js@2";
import { decideClaim, findEvidence, problemWithClaimEmail, problemWithProofUrl } from "../_shared/staffClaim.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

const MAX_BYTES = 3_000_000;
const MAX_AUTO_COORDINATORS = 3;   // more than this many coordinators at one campus need an existing coordinator's approval
const MAX_AUTO_STAFF = 12;

/** Read a page by hand so every redirect is checked against the same rule and the size is capped. */
async function download(url: string, emailDomain: string): Promise<string> {
  let at = url;
  for (let hop = 0; hop < 4; hop++) {
    const bad = problemWithProofUrl(at, emailDomain);
    if (bad) throw new Error(bad);
    const res = await fetch(at, { redirect: "manual", signal: AbortSignal.timeout(12_000), headers: { "user-agent": "OrbitStaffVerifier/1.0 (campus staff access)", accept: "text/html,*/*;q=0.5" } });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) { at = new URL(res.headers.get("location")!, at).toString(); continue; }
    if (!res.ok) throw new Error(`That page answered with an error (${res.status}).`);
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
    return new TextDecoder("utf-8").decode(all);
  }
  throw new Error("That address sends you around in circles.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, reason: "Use POST." }, 405);
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = token ? await db.auth.getUser(token) : { data: { user: null } };
    const user = u.user;
    if (!user) return json({ ok: false, reason: "Sign in first." }, 401);
    const body = (await req.json().catch(() => ({}))) as { url?: string };
    const url = (body.url ?? "").trim();
    const email = (user.email ?? "").toLowerCase();

    if (!user.email_confirmed_at) return json({ ok: false, code: "unconfirmed", reason: "Confirm your email first (use the link we sent when you signed up), then try again." });
    const badEmail = problemWithClaimEmail(email);
    if (badEmail) return json({ ok: false, code: "personal_email", reason: badEmail });
    const domain = email.split("@")[1];
    const badUrl = problemWithProofUrl(url, domain);
    if (badUrl) return json({ ok: false, code: "bad_address", reason: badUrl });

    const { data: member } = await db.from("campus_memberships").select("campus_key").eq("user_id", user.id).maybeSingle();
    const campus = (member as { campus_key: string } | null)?.campus_key;
    if (!campus) return json({ ok: false, code: "no_campus", reason: "Choose your campus in Orbit first." });

    const { data: have } = await db.from("campus_hosts").select("role").eq("user_id", user.id).maybeSingle();
    if (have) return json({ ok: true, role: (have as { role: string }).role, title: "", already: true });

    // At most five tries an hour.
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await db.from("staff_claims").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
    if ((count ?? 0) >= 5) return json({ ok: false, code: "slow_down", reason: "That is a lot of tries. Wait a little and try again." }, 429);

    const record = (status: string, extra: Record<string, unknown>) => db.from("staff_claims").insert({ user_id: user.id, campus_key: campus, email, page_url: url.slice(0, 400), status, ...extra });

    let html: string;
    try { html = await download(url, domain); } catch (e) { const reason = (e as Error).message; await record("denied", { reason }); return json({ ok: false, code: "unreadable", reason }); }
    const ev = findEvidence(html, email);
    const decision = decideClaim(ev, { path: new URL(url).pathname });
    if (!decision.ok) { await record("denied", { reason: decision.reason, claimed_title: ev.title.slice(0, 120), score: ev.score }); return json({ ok: false, code: decision.code, reason: decision.reason, title: ev.title }); }

    // How many people at this campus already hold the role? Past the limit, an existing coordinator has to approve it.
    const { count: held } = await db.from("campus_hosts").select("user_id", { count: "exact", head: true }).eq("campus_key", campus).eq("role", decision.role);
    if ((held ?? 0) >= (decision.role === "coordinator" ? MAX_AUTO_COORDINATORS : MAX_AUTO_STAFF)) {
      await record("denied", { reason: "This campus already has several people with that role; a coordinator has to approve more.", claimed_title: decision.title, score: decision.score, role: decision.role });
      return json({ ok: false, code: "needs_approval", reason: "Your page checks out, but your campus already has several people in that role. A coordinator there needs to approve you.", title: decision.title });
    }

    const { error } = await db.from("campus_hosts").insert({ user_id: user.id, campus_key: campus, label: decision.title.slice(0, 80) || "Staff", role: decision.role, source: "claim", directory_email: email });
    if (error) throw new Error(error.message);
    await record("approved", { claimed_title: decision.title, score: decision.score, role: decision.role, reason: "Verified from the school's own page." });
    // Tell the campus's other coordinators, and the person.
    const { data: coords } = await db.from("campus_hosts").select("user_id").eq("campus_key", campus).eq("role", "coordinator").neq("user_id", user.id);
    const note = `${decision.title || "Someone"} was given ${decision.role} access (verified from the school's website)`;
    await db.from("notifications").insert([
      { recipient_id: user.id, actor_id: user.id, kind: "event", body: `You now have ${decision.role} access for your campus` },
      ...((coords ?? []) as { user_id: string }[]).map((c) => ({ recipient_id: c.user_id, actor_id: user.id, kind: "event", body: note.slice(0, 200) })),
    ]);
    return json({ ok: true, role: decision.role, title: decision.title });
  } catch (e) {
    return json({ ok: false, code: "error", reason: (e as Error).message || "Something went wrong." }, 500);
  }
});
