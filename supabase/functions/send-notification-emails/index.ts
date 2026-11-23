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

type Row = { id: number; recipient_id: string; actor_id: string | null; kind: string; body: string; post_id: string | null };
type Item = { text: string; url: string };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

/** One readable line (who did what) and the page it opens. Some bodies already name the thing ("Approved: Chess club"); the rest are a verb phrase. */
function item(r: Row, who: Map<string, string>): Item {
  const name = r.actor_id ? who.get(r.actor_id) : undefined;
  const body = r.body.trim();
  const text = !name || /^(approved|not approved|paused|you were)/i.test(body) ? body || "Something new in Orbit" : `${name} ${body}`.trim();
  let path = "/app";
  if (r.kind === "message") path = "/app/chats";
  else if (r.kind === "group_add") path = "/app/chats?tab=groups";
  else if (r.kind === "friend_request" || r.kind === "friend_accept") path = r.actor_id ? `/app/people/${r.actor_id}` : "/app/chats";
  else if (r.kind === "event" || r.kind === "hangout" || r.kind === "place") path = "/app/campus";
  else if (r.post_id) path = `/app/feed?post=${r.post_id}`;
  else if (r.kind === "like" || r.kind === "comment" || r.kind === "reply") path = "/app/feed";
  return { text, url: APP + path };
}

// A signed address that turns emails off for one student without signing in. Only this function can make or check it.
const enc = new TextEncoder();
async function sign(user: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(env("EMAIL_CRON_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`unsub:${user}`)));
  return [...sig].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
const unsubUrl = async (user: string) => `${env("SUPABASE_URL")}/functions/v1/send-notification-emails?unsub=${user}.${await sign(user)}`;

async function turnOff(token: string): Promise<boolean> {
  const [user, sig] = token.split(".");
  if (!user || !sig || sig !== (await sign(user))) return false;
  const cur = await db.from("student_profiles").select("nudges").eq("user_id", user).maybeSingle();
  if (cur.error || !cur.data) return false;
  const nudges = { ...((cur.data.nudges as Record<string, boolean> | null) ?? {}), email: false };
  const done = await db.from("student_profiles").update({ nudges }).eq("user_id", user);
  return !done.error;
}

async function sendEmail(to: string, user: string, lines: Item[], more: number): Promise<boolean> {
  const n = lines.length + more;
  const subject = n === 1 ? lines[0].text.slice(0, 90) : `${lines[0].text.slice(0, 60)} and ${n - 1} more in Orbit`;
  const off = await unsubUrl(user);
  const items = lines.map((l) => `<tr><td style="padding:12px 0;border-top:1px solid #e8e3da;font-size:15px;line-height:1.4"><a href="${l.url}" style="color:#1d1b19;text-decoration:none">${esc(l.text)}</a></td></tr>`).join("");
  const html = `<div style="background:#f3f0ea;padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1d1b19">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px 24px 20px">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr>
<td style="width:26px;height:26px;border-radius:13px;background:#d9552b;font-size:0;line-height:0">&nbsp;</td>
<td style="padding-left:10px;font-size:18px;font-weight:700;letter-spacing:-.01em">Orbit</td></tr></table>
<p style="font-size:15px;margin:0 0 8px">${n === 1 ? "You have something new:" : `You have ${n} things new:`}</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px">${items}<tr><td style="border-top:1px solid #e8e3da;font-size:1px;line-height:1px">&nbsp;</td></tr></table>${more > 0 ? `<p style="font-size:14px;color:#6b665f;margin:0 0 8px">and ${more} more.</p>` : ""}
<p style="margin:16px 0 24px"><a href="${APP}/app" style="background:#d9552b;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block">Open Orbit</a></p>
<p style="font-size:12px;line-height:1.5;color:#6b665f;margin:0">You get one of these at most every few hours, and only for things you have not opened. <a href="${off}" style="color:#6b665f">Unsubscribe</a> from these emails.</p>
</div></div>`;
  const text = `You have something new in Orbit:\n\n${lines.map((l) => `- ${l.text}\n  ${l.url}`).join("\n")}${more > 0 ? `\nand ${more} more.` : ""}\n\nOpen Orbit: ${APP}/app\n\nUnsubscribe from these emails: ${off}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html, text, headers: { "List-Unsubscribe": `<${off}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  const secret = env("EMAIL_CRON_SECRET");
  // The unsubscribe address in each email. It carries its own signature, so it needs no sign-in or schedule secret.
  const unsub = new URL(req.url).searchParams.get("unsub");
  if (unsub) {
    if (!secret) return new Response("Not allowed", { status: 401 });
    const ok = await turnOff(unsub);
    if (req.method === "POST") return new Response(ok ? "ok" : "invalid", { status: ok ? 200 : 400 });
    return Response.redirect(`${APP}/email-off${ok ? "" : "?problem=1"}`, 302);
  }
  if (!secret || req.headers.get("x-cron-secret") !== secret) return new Response("Not allowed", { status: 401 });
  if (!env("RESEND_API_KEY")) return new Response("Email is not set up", { status: 503 });
  try {
    const now = Date.now();
    const rows = await db.from("notifications").select("id,recipient_id,actor_id,kind,body,post_id")
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
      const shown = mine.slice(0, MAX_LINES).map((r) => item(r, who));
      if (await sendEmail(to, user, shown, mine.length - shown.length)) {
        await db.from("notifications").update({ emailed_at: new Date().toISOString() }).in("id", mine.map((r) => r.id));
        emailed++;
      }
    }
    return Response.json({ emailed });
  } catch (e) {
    return new Response((e as Error).message, { status: 500 });
  }
});
