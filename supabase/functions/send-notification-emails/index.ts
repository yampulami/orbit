// Emails a student what they have not seen (unread notifications) and a reminder for events they are going to.
// Run it every 10 minutes (see EMAIL-SETUP.md). Safe to run twice: each notification is marked `emailed_at`, each reminder is remembered in `email_event_reminders`.
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
const COOLDOWN_HOURS = 3; // at most one email this often per student ...
const DAILY_COOLDOWN_HOURS = 22; // ... or once a day for students who chose that
const REMIND_AHEAD_HOURS = 24; // event reminders go out once an event is this close
const REMIND_MIN_MINUTES = 30; // ... and are skipped when it is almost starting
const MAX_PEOPLE = 100; // per run
const DAILY_CAP = 60; // emails per UTC day, to stay well inside the free Resend plan (100 a day)
let budget = 0; // emails still allowed today; set at the start of each run
const MAX_LINES = 8;
const NEVER = "1970-01-01T00:00:00Z"; // "handled, no email" mark: older than any cooldown window

type Row = { id: number; recipient_id: string; actor_id: string | null; kind: string; body: string; post_id: string | null };
type Item = { text: string; url: string };
type Prefs = { email?: boolean; emailMessages?: boolean; emailSocial?: boolean; emailCampus?: boolean; emailEvents?: boolean; emailDaily?: boolean };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

/** Which switch in Profile a kind of notification belongs to. */
const groupOf = (kind: string): "emailMessages" | "emailSocial" | "emailCampus" =>
  kind === "message" || kind === "group_add" ? "emailMessages"
    : ["like", "comment", "reply", "friend_request", "friend_accept"].includes(kind) ? "emailSocial" : "emailCampus";

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

async function sendEmail(to: string, user: string, subject: string, intro: string, lines: Item[], more: number): Promise<boolean> {
  const off = await unsubUrl(user);
  const rows = lines.map((l) => `<tr><td style="padding:12px 0;border-top:1px solid #e8e3da;font-size:15px;line-height:1.4"><a href="${l.url}" style="color:#1d1b19;text-decoration:none">${esc(l.text)}</a></td></tr>`).join("");
  const html = `<div style="background:#f3f0ea;padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1d1b19">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px 24px 20px">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr>
<td style="width:26px;height:26px;border-radius:13px;background:#d9552b;font-size:0;line-height:0">&nbsp;</td>
<td style="padding-left:10px;font-size:18px;font-weight:700;letter-spacing:-.01em">Orbit</td></tr></table>
<p style="font-size:15px;margin:0 0 8px">${esc(intro)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px">${rows}<tr><td style="border-top:1px solid #e8e3da;font-size:1px;line-height:1px">&nbsp;</td></tr></table>${more > 0 ? `<p style="font-size:14px;color:#6b665f;margin:0 0 8px">and ${more} more.</p>` : ""}
<p style="margin:16px 0 24px"><a href="${APP}/app" style="background:#d9552b;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block">Open Orbit</a></p>
<p style="font-size:12px;line-height:1.5;color:#6b665f;margin:0">Choose which emails you get in Profile, under Notifications. <a href="${off}" style="color:#6b665f">Unsubscribe</a> from all of them.</p>
</div></div>`;
  const text = `${intro}\n\n${lines.map((l) => `- ${l.text}\n  ${l.url}`).join("\n")}${more > 0 ? `\nand ${more} more.` : ""}\n\nOpen Orbit: ${APP}/app\n\nUnsubscribe from these emails: ${off}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html, text, headers: { "List-Unsubscribe": `<${off}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }),
  });
  return res.ok;
}

const emailOf = async (user: string) => (await db.auth.admin.getUserById(user)).data.user?.email;

/** How many emails went out since midnight UTC: each email stamps its rows with one shared time, so count distinct (student, time) pairs. */
async function sentToday(now: number): Promise<number> {
  const day = new Date(now); day.setUTCHours(0, 0, 0, 0);
  const since = day.toISOString();
  const [a, b] = await Promise.all([
    db.from("notifications").select("recipient_id,emailed_at").gte("emailed_at", since).limit(5000),
    db.from("email_event_reminders").select("user_id,sent_at").gte("sent_at", since).limit(5000),
  ]);
  if (a.error) throw new Error(a.error.message);
  if (b.error) throw new Error(b.error.message);
  return new Set([...(a.data ?? []).map((r) => `n${r.recipient_id}${r.emailed_at}`), ...(b.data ?? []).map((r) => `e${r.user_id}${r.sent_at}`)]).size;
}

/** What has sat unread in the bell: one email per student, only for the kinds they want, no more often than their chosen rhythm. */
async function unreadEmails(now: number): Promise<number> {
  const rows = await db.from("notifications").select("id,recipient_id,actor_id,kind,body,post_id")
    .is("emailed_at", null).is("read_at", null)
    .lte("created_at", new Date(now - QUIET_MINUTES * 60_000).toISOString())
    .gte("created_at", new Date(now - LOOKBACK_HOURS * 3600_000).toISOString())
    .order("created_at", { ascending: true }).limit(1000);
  if (rows.error) throw new Error(rows.error.message);
  const all = (rows.data ?? []) as Row[];
  if (!all.length) return 0;

  const people = [...new Set(all.map((r) => r.recipient_id))].slice(0, MAX_PEOPLE);
  const actors = [...new Set(all.map((r) => r.actor_id).filter((x): x is string => !!x))];
  const [recent, prefsRes, names] = await Promise.all([
    db.from("notifications").select("recipient_id").in("recipient_id", people).gte("emailed_at", new Date(now - DAILY_COOLDOWN_HOURS * 3600_000).toISOString()),
    db.from("student_profiles").select("user_id,nudges").in("user_id", people),
    actors.length ? db.from("student_profiles").select("user_id,display_name").in("user_id", actors) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [recent, prefsRes, names]) if (r.error) throw new Error(r.error.message);
  const prefs = new Map((prefsRes.data ?? []).map((p) => [p.user_id as string, (p.nudges ?? {}) as Prefs]));
  const who = new Map((names.data ?? []).map((n) => [n.user_id as string, n.display_name as string]));
  // when each student was last emailed: a short window for most, a long one for "once a day"
  const lastIds = new Set((recent.data ?? []).map((r) => r.recipient_id as string));
  const recentShort = await db.from("notifications").select("recipient_id").in("recipient_id", people).gte("emailed_at", new Date(now - COOLDOWN_HOURS * 3600_000).toISOString());
  if (recentShort.error) throw new Error(recentShort.error.message);
  const shortIds = new Set((recentShort.data ?? []).map((r) => r.recipient_id as string));

  let emailed = 0;
  for (const user of people) {
    const p = prefs.get(user) ?? {};
    const mine = all.filter((r) => r.recipient_id === user);
    const wanted = p.email === false ? [] : mine.filter((r) => p[groupOf(r.kind)] !== false);
    // things they did not want are marked handled, so they do not pile up and crowd the next run
    const skipped = mine.filter((r) => !wanted.includes(r));
    if (skipped.length) await db.from("notifications").update({ emailed_at: NEVER }).in("id", skipped.map((r) => r.id));
    if (!wanted.length) continue;
    if (budget <= 0) break; // out of emails for today: the rest wait for tomorrow (they are still unread, up to 48 hours)
    if ((p.emailDaily ? lastIds : shortIds).has(user)) continue;
    const to = await emailOf(user);
    if (!to) continue;
    const shown = wanted.slice(0, MAX_LINES).map((r) => item(r, who));
    const n = wanted.length;
    const subject = n === 1 ? shown[0].text.slice(0, 90) : `${shown[0].text.slice(0, 60)} and ${n - 1} more in Orbit`;
    const intro = n === 1 ? "You have something new:" : `You have ${n} new things:`;
    if (await sendEmail(to, user, subject, intro, shown, n - shown.length)) {
      await db.from("notifications").update({ emailed_at: new Date().toISOString() }).in("id", wanted.map((r) => r.id));
      emailed++; budget--;
    }
  }
  return emailed;
}

/** One email per student about the events they said they are going to that start within a day. */
async function eventReminders(now: number): Promise<number> {
  const ev = await db.from("campus_events").select("id,title,place_name,starts_at")
    .eq("status", "published").is("canceled_at", null)
    .gt("starts_at", new Date(now + REMIND_MIN_MINUTES * 60_000).toISOString())
    .lte("starts_at", new Date(now + REMIND_AHEAD_HOURS * 3600_000).toISOString());
  if (ev.error) throw new Error(ev.error.message);
  const events = ev.data ?? [];
  if (!events.length) return 0;
  const ids = events.map((e) => e.id as string);
  const [going, done] = await Promise.all([
    db.from("campus_event_responses").select("event_id,user_id").in("event_id", ids).eq("answer", "going"),
    db.from("email_event_reminders").select("event_id,user_id").in("event_id", ids),
  ]);
  for (const r of [going, done]) if (r.error) throw new Error(r.error.message);
  const sent = new Set((done.data ?? []).map((d) => `${d.event_id}:${d.user_id}`));
  const byUser = new Map<string, typeof events>();
  for (const g of going.data ?? []) {
    if (sent.has(`${g.event_id}:${g.user_id}`)) continue;
    const e = events.find((x) => x.id === g.event_id);
    if (e) byUser.set(g.user_id as string, [...(byUser.get(g.user_id as string) ?? []), e]);
  }
  const people = [...byUser.keys()].slice(0, MAX_PEOPLE);
  if (!people.length) return 0;
  const prefsRes = await db.from("student_profiles").select("user_id,nudges").in("user_id", people);
  if (prefsRes.error) throw new Error(prefsRes.error.message);
  const prefs = new Map((prefsRes.data ?? []).map((p) => [p.user_id as string, (p.nudges ?? {}) as Prefs]));

  let count = 0;
  for (const user of people) {
    const p = prefs.get(user) ?? {};
    const mine = byUser.get(user) ?? [];
    // a student who turned these off is marked as reminded, so the question is not asked again every ten minutes
    if (p.email === false || p.emailEvents === false) {
      await db.from("email_event_reminders").upsert(mine.map((e) => ({ event_id: e.id, user_id: user })));
      continue;
    }
    if (budget <= 0) break;
    const to = await emailOf(user);
    if (!to) continue;
    const lines: Item[] = mine.map((e) => {
      const hours = Math.max(1, Math.round((new Date(e.starts_at as string).getTime() - now) / 3600_000));
      return { text: `${e.title}: starts in about ${hours} ${hours === 1 ? "hour" : "hours"}${e.place_name ? ` at ${e.place_name}` : ""}`, url: `${APP}/app/campus` };
    });
    const subject = mine.length === 1 ? `Coming up: ${mine[0].title}`.slice(0, 90) : `${mine.length} events you are going to are coming up`;
    if (await sendEmail(to, user, subject, mine.length === 1 ? "An event you are going to is coming up:" : "Events you are going to are coming up:", lines, 0)) {
      await db.from("email_event_reminders").upsert(mine.map((e) => ({ event_id: e.id, user_id: user })));
      count++; budget--;
    }
  }
  return count;
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
    budget = DAILY_CAP - (await sentToday(now));
    if (budget <= 0) return Response.json({ emailed: 0, reminders: 0, note: "daily cap reached" });
    const emailed = await unreadEmails(now);
    const reminders = await eventReminders(now);
    return Response.json({ emailed, reminders });
  } catch (e) {
    return new Response((e as Error).message, { status: 500 });
  }
});
