// Emails a student one short message with what has sat unread in their bell for a while, so they do not have to keep checking the app.
// Run it every 10 minutes (see EMAIL-SETUP.md). Safe to run twice: each notification is marked `emailed_at` once it is in an email.
//
// Secrets: RESEND_API_KEY, EMAIL_CRON_SECRET, and optionally EMAIL_FROM (default "Orbit <notifications@orbitcampus.org>") and APP_URL (default https://www.orbitcampus.org).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase itself.
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (k: string, d = "") => Deno.env.get(k) ?? d;
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const FROM = env("EMAIL_FROM", "Orbit <notifications@orbitcampus.org>");
const APP = env("APP_URL", "https://www.orbitcampus.org").replace(/\/$/, "");

const QUIET_MINUTES = 15; // anything newer than this may still be seen in the app
const LOOKBACK_HOURS = 48; // older than this is no longer news
const COOLDOWN_HOURS = 3; // at most one email this often per student
const MAX_PEOPLE = 100; // per run
const MAX_LINES = 8;

type Row = { id: number; recipient_id: string; actor_id: string | null; kind: string; body: string };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

/** One readable line: who did what. Some bodies already name the thing ("Approved: Chess club"); the rest are a verb phrase. */
function line(r: Row, who: Map<string, string>) {
  const name = r.actor_id ? who.get(r.actor_id) : undefined;
  const body = r.body.trim();
  if (!name || /^(approved|not approved|paused|you were)/i.test(body)) return body || "Something new in Orbit";
  return `${name} ${body}`.trim();
}

async function sendEmail(to: string, lines: string[], more: number): Promise<boolean> {
  const n = lines.length + more;
  const subject = n === 1 ? lines[0].slice(0, 90) : `${n} things waiting for you in Orbit`;
  const items = lines.map((l) => `<li style="margin:0 0 8px">${esc(l)}</li>`).join("");
  const html = `<div style="font-family:system-ui,Segoe UI,sans-serif;color:#1d1b19;max-width:480px;margin:0 auto;padding:24px">
<p style="font-size:15px;margin:0 0 12px">Here is what you have not seen yet:</p>
<ul style="font-size:15px;padding-left:20px;margin:0 0 16px">${items}</ul>${more > 0 ? `<p style="font-size:14px;color:#6b665f;margin:0 0 16px">and ${more} more.</p>` : ""}
<p style="margin:0 0 24px"><a href="${APP}/app" style="background:#d9552b;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:15px">Open Orbit</a></p>
<p style="font-size:12px;color:#6b665f;margin:0">You get one of these at most every few hours. Turn it off in Profile, under Notifications, "Email me what I missed".</p></div>`;
  const text = `Here is what you have not seen yet:\n\n${lines.map((l) => `- ${l}`).join("\n")}${more > 0 ? `\nand ${more} more.` : ""}\n\nOpen Orbit: ${APP}/app\n\nTurn these emails off in Profile, under Notifications.`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html, text }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  const secret = env("EMAIL_CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return new Response("Not allowed", { status: 401 });
  if (!env("RESEND_API_KEY")) return new Response("Email is not set up", { status: 503 });
  try {
    const now = Date.now();
    const rows = await db.from("notifications").select("id,recipient_id,actor_id,kind,body")
      .is("emailed_at", null).is("read_at", null)
      .lte("created_at", new Date(now - QUIET_MINUTES * 60_000).toISOString())
      .gte("created_at", new Date(now - LOOKBACK_HOURS * 3600_000).toISOString())
      .order("created_at", { ascending: true }).limit(1000);
    if (rows.error) throw new Error(rows.error.message);
    const all = (rows.data ?? []) as Row[];
    if (!all.length) return Response.json({ emailed: 0 });

    const people = [...new Set(all.map((r) => r.recipient_id))].slice(0, MAX_PEOPLE);
    const actors = [...new Set(all.map((r) => r.actor_id).filter((x): x is string => !!x))];
    const recent = await db.from("notifications").select("recipient_id").in("recipient_id", people)
      .gte("emailed_at", new Date(now - COOLDOWN_HOURS * 3600_000).toISOString());
    if (recent.error) throw new Error(recent.error.message);
    const cooling = new Set((recent.data ?? []).map((r) => r.recipient_id));
    const [prefs, names] = await Promise.all([
      db.from("student_profiles").select("user_id,nudges").in("user_id", people),
      actors.length ? db.from("student_profiles").select("user_id,display_name").in("user_id", actors) : Promise.resolve({ data: [], error: null }),
    ]);
    for (const r of [prefs, names]) if (r.error) throw new Error(r.error.message);
    const off = new Set((prefs.data ?? []).filter((p) => (p.nudges as { email?: boolean } | null)?.email === false).map((p) => p.user_id));
    const who = new Map((names.data ?? []).map((n) => [n.user_id as string, n.display_name as string]));

    let emailed = 0;
    for (const user of people) {
      if (off.has(user) || cooling.has(user)) continue;
      const mine = all.filter((r) => r.recipient_id === user);
      const got = await db.auth.admin.getUserById(user);
      const to = got.data.user?.email;
      if (!to) continue;
      const shown = mine.slice(0, MAX_LINES).map((r) => line(r, who));
      if (await sendEmail(to, shown, mine.length - shown.length)) {
        await db.from("notifications").update({ emailed_at: new Date().toISOString() }).in("id", mine.map((r) => r.id));
        emailed++;
      }
    }
    return Response.json({ emailed });
  } catch (e) {
    return new Response((e as Error).message, { status: 500 });
  }
});
