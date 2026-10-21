// Sends web pushes for reminders that just came due and hangouts that are about to start, even when Orbit is closed.
// Run it every minute (see PUSH-SETUP.md). It is safe to run twice: `push_sent` remembers what was already pushed.
//
// Secrets it needs (set with `supabase secrets set`, never put them in the app or in git):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (for example mailto:you@example.com), PUSH_CRON_SECRET
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided to the function by Supabase itself.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const env = (k: string) => Deno.env.get(k) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
webpush.setVapidDetails(env("VAPID_SUBJECT"), env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };
type Job = { kind: "reminder" | "hangout"; item: string; user: string; nudge: "reminders" | "hangouts"; title: string; body: string; url: string };

const LEAD_MINUTES = 30; // hangouts: push this long before they start
const REMINDER_WINDOW_HOURS = 6; // reminders: skip ones that came due longer ago than this (for example after downtime)

async function collectJobs(): Promise<Job[]> {
  const now = new Date();
  const jobs: Job[] = [];

  const rem = await db.from("reminders").select("id,user_id,title").eq("done", false)
    .lte("due_at", now.toISOString()).gte("due_at", new Date(now.getTime() - REMINDER_WINDOW_HOURS * 3600_000).toISOString());
  if (rem.error) throw new Error(rem.error.message);
  for (const r of rem.data ?? []) jobs.push({ kind: "reminder", item: r.id, user: r.user_id, nudge: "reminders", title: "Reminder", body: r.title, url: "/app/plans" });

  const soon = new Date(now.getTime() + LEAD_MINUTES * 60_000).toISOString();
  const hang = await db.from("campus_hangouts").select("id,title,place_name,starts_at,created_by").is("canceled_at", null)
    .gt("starts_at", now.toISOString()).lte("starts_at", soon);
  if (hang.error) throw new Error(hang.error.message);
  const ids = (hang.data ?? []).map((h) => h.id);
  const yes = ids.length ? await db.from("campus_hangout_rsvps").select("hangout_id,user_id").in("hangout_id", ids).eq("answer", "yes") : { data: [], error: null };
  if (yes.error) throw new Error(yes.error.message);
  for (const h of hang.data ?? []) {
    const people = new Set<string>([h.created_by, ...(yes.data ?? []).filter((y) => y.hangout_id === h.id).map((y) => y.user_id)]);
    // The server does not know the student's time zone, so the body says how long until it starts instead of a clock time.
    const mins = Math.max(1, Math.round((new Date(h.starts_at).getTime() - now.getTime()) / 60_000));
    for (const user of people) jobs.push({ kind: "hangout", item: h.id, user, nudge: "hangouts", title: h.title, body: `Starts in ${mins} min · ${h.place_name}`, url: "/app/plans" });
  }
  return jobs;
}

Deno.serve(async (req) => {
  const secret = env("PUSH_CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return new Response("Not allowed", { status: 401 });
  try {
    const all = await collectJobs();
    if (!all.length) return Response.json({ sent: 0 });

    const users = [...new Set(all.map((j) => j.user))];
    const [done, prefs, subs] = await Promise.all([
      db.from("push_sent").select("kind,item_id,user_id").in("user_id", users),
      db.from("student_profiles").select("user_id,nudges").in("user_id", users),
      db.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth").in("user_id", users),
    ]);
    for (const r of [done, prefs, subs]) if (r.error) throw new Error(r.error.message);
    const already = new Set((done.data ?? []).map((d) => `${d.kind}:${d.item_id}:${d.user_id}`));
    const nudges = new Map((prefs.data ?? []).map((p) => [p.user_id, (p.nudges ?? {}) as Record<string, boolean>]));
    const byUser = new Map<string, Sub[]>();
    for (const s of (subs.data ?? []) as Sub[]) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

    let sent = 0;
    const gone: string[] = [];
    for (const j of all) {
      if (already.has(`${j.kind}:${j.item}:${j.user}`)) continue;
      if (nudges.get(j.user)?.[j.nudge] === false) continue; // they turned this kind of nudge off
      const targets = byUser.get(j.user) ?? [];
      if (!targets.length) continue;
      const payload = JSON.stringify({ title: j.title, body: j.body, url: j.url, tag: `${j.kind}-${j.item}` });
      let ok = false;
      await Promise.all(targets.map(async (t) => {
        try {
          await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload, { TTL: 3600 });
          ok = true;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) gone.push(t.id); // the browser says this address no longer exists
        }
      }));
      if (ok) {
        sent++;
        await db.from("push_sent").upsert({ kind: j.kind, item_id: j.item, user_id: j.user });
      }
    }
    if (gone.length) await db.from("push_subscriptions").delete().in("id", gone);
    return Response.json({ sent, cleaned: gone.length });
  } catch (e) {
    return new Response((e as Error).message, { status: 500 });
  }
});
