// A personal email for an account, so a student keeps Orbit after the school deletes their school address.
//
//   start    (signed in)  { email, password }    sends a 6 digit code to that address (the password shows it is the owner, not someone at an open laptop)
//   confirm  (signed in)  { code }               the address is now a verified second email for the account
//   remove   (signed in)  { password }           forgets it
//   promote  (signed in)  { password }           the personal address becomes the account main email (for after the school address is gone)
//   reset-start  (public) { email }              if that is a verified second email, sends a password reset code to it. Always answers the same.
//   reset-finish (public) { email, code, password }   checks the code, sets the new password, returns a session
//
// Secrets: RESEND_API_KEY (and optionally EMAIL_FROM), shared with send-notification-emails.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase itself.
// Deploy with --no-verify-jwt: the public actions have no session, and the signed-in ones check the session here.
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (k: string, d = "") => Deno.env.get(k) ?? d;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
const FROM = env("EMAIL_FROM", "Orbit <notifications@orbitcampus.org>");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SAME = "If that address can be used, a code is on its way.";

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const hashCode = async (code: string, user: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${user}:${code}`)));
const newCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");

async function allowed(key: string, max: number, seconds: number) {
  const r = await admin.rpc("rate_limit_hit", { p_key: key, p_max: max, p_window_seconds: seconds });
  return r.data !== false; // if the counter is unavailable the request goes on
}

async function mail(to: string, subject: string, line: string, code: string) {
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#1d1b19">
<p style="font-size:15px;margin:0 0 16px">${line}</p>
<p style="font-size:32px;letter-spacing:6px;font-weight:700;margin:0 0 16px">${code}</p>
<p style="font-size:13px;color:#6b665f;margin:0">It works for 15 minutes. If you did not ask for it, ignore this email.</p></div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html, text: `${line}\n\n${code}\n\nIt works for 15 minutes. If you did not ask for it, ignore this email.` }),
  });
  return res.ok;
}

/** Adding, removing or promoting an address needs the current password, so a session left open on someone else's screen cannot take the account. */
async function passwordOk(user: { id: string; email?: string }, password: string): Promise<"yes" | "no" | "limit"> {
  if (!user.email || !password || password.length > 200) return "no";
  if (!(await allowed("bk-pw:" + user.id, 8, 900))) return "limit";
  const anon = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email: user.email, password });
  return !error && data.session ? "yes" : "no";
}

/** A plain heads-up to an address when something about the account emails changed. */
async function heading(to: string | undefined, subject: string, text: string) {
  if (!to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, text: `${text}\n\nIf this was not you, sign in to Orbit and change your password at once.` }),
  }).catch(() => undefined);
}

async function userFrom(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  return data.user ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply({ error: "Use POST." }, 405);
  if (!env("RESEND_API_KEY")) return reply({ error: "Email is not set up yet." }, 503);

  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { return reply({ error: "Bad request." }, 400); }
  const action = String(b.action ?? "");
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";

  try {
    // ---- signed in ----
    if (action === "start" || action === "confirm" || action === "remove" || action === "promote") {
      const user = await userFrom(req);
      if (!user) return reply({ error: "Sign in first." }, 401);

      if (action === "start" || action === "remove" || action === "promote") {
        const pw = await passwordOk(user, String(b.password ?? ""));
        if (pw === "limit") return reply({ error: "Too many tries. Please wait a few minutes." }, 429);
        if (pw === "no") return reply({ error: "That password is not right." }, 401);
      }

      if (action === "start") {
        const email = String(b.email ?? "").trim().toLowerCase();
        if (!EMAIL.test(email) || email.length > 254) return reply({ error: "That does not look like an email address." }, 400);
        if (email === (user.email ?? "").toLowerCase()) return reply({ error: "That is your school email. Use a personal one." }, 400);
        if (!(await allowed("bk-start:" + user.id, 5, 3600)) || !(await allowed("bk-start-ip:" + ip, 20, 3600))) return reply({ error: "Too many tries. Please wait a while and try again." }, 429);
        // an address already verified by someone else cannot be used; said the same way as any other failure
        const taken = await admin.from("private_contacts").select("user_id").eq("backup_email", email).maybeSingle();
        if (taken.data && taken.data.user_id !== user.id) return reply({ error: "That address cannot be used. Try another." }, 400);
        const code = newCode();
        await admin.from("email_codes").upsert({ user_id: user.id, purpose: "verify", email, code_hash: await hashCode(code, user.id), expires_at: new Date(Date.now() + 15 * 60_000).toISOString(), attempts: 0 });
        const ok = await mail(email, `${code} is your Orbit code`, "Use this code to add this address to your Orbit account:", code);
        return ok ? reply({ ok: true }) : reply({ error: "We could not send that email. Check the address and try again." }, 502);
      }

      if (action === "confirm") {
        const code = String(b.code ?? "").trim();
        const row = await admin.from("email_codes").select("email,code_hash,expires_at,attempts").eq("user_id", user.id).eq("purpose", "verify").maybeSingle();
        if (!row.data || new Date(row.data.expires_at).getTime() < Date.now()) return reply({ error: "That code has expired. Ask for a new one." }, 400);
        if (row.data.attempts >= 5) return reply({ error: "Too many wrong codes. Ask for a new one." }, 429);
        if ((await hashCode(code, user.id)) !== row.data.code_hash) {
          await admin.from("email_codes").update({ attempts: row.data.attempts + 1 }).eq("user_id", user.id).eq("purpose", "verify");
          return reply({ error: "That code is not right." }, 400);
        }
        const saved = await admin.from("private_contacts").upsert({ user_id: user.id, backup_email: row.data.email, verified_at: new Date().toISOString() });
        if (saved.error) return reply({ error: "That address cannot be used. Try another." }, 400);
        await admin.from("email_codes").delete().eq("user_id", user.id).eq("purpose", "verify");
        await heading(user.email, "A personal email was added to your Orbit account", `The address ${row.data.email} was added to your Orbit account. It can now sign in and reset the password.`);
        return reply({ ok: true, email: row.data.email });
      }

      if (action === "promote") {
        const c = await admin.from("private_contacts").select("backup_email").eq("user_id", user.id).maybeSingle();
        if (!c.data) return reply({ error: "Add and confirm a personal email first." }, 400);
        const oldEmail = user.email;
        const done = await admin.auth.admin.updateUserById(user.id, { email: c.data.backup_email, email_confirm: true });
        if (done.error) return reply({ error: "We could not switch your email. Try again." }, 400);
        await admin.from("private_contacts").delete().eq("user_id", user.id);
        await heading(oldEmail, "Your Orbit account now uses a personal email", `Your Orbit account now signs in with ${c.data.backup_email}. This address no longer works for it.`);
        await heading(c.data.backup_email, "Your Orbit account now uses this email", "This is now the main email for your Orbit account. Sign in with it and your password.");
        return reply({ ok: true, email: c.data.backup_email });
      }

      const gone = await admin.from("private_contacts").select("backup_email").eq("user_id", user.id).maybeSingle();
      await admin.from("private_contacts").delete().eq("user_id", user.id);
      await heading(user.email, "The personal email was removed from your Orbit account", `${gone.data?.backup_email ?? "Your personal email"} was removed from your Orbit account.`);
      await heading(gone.data?.backup_email, "This email was removed from an Orbit account", "It no longer signs in to Orbit or resets its password.");
      return reply({ ok: true });
    }

    // ---- public: reset a password through the personal address ----
    if (action === "reset-start") {
      const email = String(b.email ?? "").trim().toLowerCase();
      if (!EMAIL.test(email) || email.length > 254) return reply({ message: SAME });
      if (!(await allowed("bk-reset:" + email, 3, 600)) || !(await allowed("bk-reset-ip:" + ip, 10, 600))) return reply({ message: SAME });
      const c = await admin.from("private_contacts").select("user_id").eq("backup_email", email).maybeSingle();
      if (c.data) {
        const u = await admin.auth.admin.getUserById(c.data.user_id);
        const authEmail = u.data.user?.email;
        if (authEmail) {
          const link = await admin.auth.admin.generateLink({ type: "recovery", email: authEmail });
          const otp = link.data?.properties?.email_otp;
          if (otp) await mail(email, `${otp} is your Orbit reset code`, "Use this code to reset your Orbit password:", otp);
        }
      }
      return reply({ message: SAME });
    }

    if (action === "reset-finish") {
      const email = String(b.email ?? "").trim().toLowerCase();
      const code = String(b.code ?? "").trim();
      const password = String(b.password ?? "");
      const NO = "That code is not right, or it has expired. Ask for a new one.";
      if (!EMAIL.test(email) || !/^\d{6,10}$/.test(code) || password.length < 8 || password.length > 200) return reply({ error: NO }, 400);
      if (!(await allowed("bk-finish:" + email, 5, 600)) || !(await allowed("bk-finish-ip:" + ip, 20, 600))) return reply({ error: "Too many tries. Please wait a few minutes." }, 429);
      const c = await admin.from("private_contacts").select("user_id").eq("backup_email", email).maybeSingle();
      if (!c.data) return reply({ error: NO }, 400);
      const u = await admin.auth.admin.getUserById(c.data.user_id);
      const authEmail = u.data.user?.email;
      if (!authEmail) return reply({ error: NO }, 400);
      const anon = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
      const v = await anon.auth.verifyOtp({ email: authEmail, token: code, type: "recovery" });
      if (v.error || !v.data.session) return reply({ error: NO }, 400);
      const set = await admin.auth.admin.updateUserById(c.data.user_id, { password });
      if (set.error) return reply({ error: "We could not save the new password. Try again." }, 400);
      return reply({ access_token: v.data.session.access_token, refresh_token: v.data.session.refresh_token });
    }

    return reply({ error: "Unknown action." }, 400);
  } catch (e) {
    return reply({ error: (e as Error).message }, 500);
  }
});
