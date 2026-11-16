// Signs a student in with an email OR a username plus a password.
//
// Why a function: a username has to be turned into an email before the password can be checked, and the app must never be able to ask
// "what is the email for this username?" (that would let anyone collect students' emails). So the lookup happens here, on the server,
// and the app only ever gets back a session, or one vague error that is the same for an unknown name and a wrong password.
//
// Needs nothing extra: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided to the function by Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (k: string) => Deno.env.get(k) ?? "";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const NOT_RIGHT = "That username, email or password is not right.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply({ error: "Use POST." }, 405);

  let identifier = "", password = "";
  try {
    const b = await req.json();
    identifier = String(b.identifier ?? "").trim();
    password = String(b.password ?? "");
  } catch { return reply({ error: NOT_RIGHT }, 400); }
  if (!identifier || !password || identifier.length > 254 || password.length > 200) return reply({ error: NOT_RIGHT }, 401);

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });

  // Rate limits, checked before any lookup so a guesser learns nothing and the database is not hammered: 20 tries / 10 min from one address,
  // and 8 / 15 min against one account name (so a botnet cannot guess one student's password either). The limit hits when the function is in
  // use; if the counter itself is unavailable the request goes on (Supabase Auth's own limits still apply).
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const tooMany = () => reply({ error: "Too many tries. Please wait a few minutes and try again." }, 429);
  const byIp = await admin.rpc("rate_limit_hit", { p_key: "signin-ip:" + ip, p_max: 20, p_window_seconds: 600 });
  if (byIp.data === false) return tooMany();
  const byName = await admin.rpc("rate_limit_hit", { p_key: "signin-name:" + identifier.toLowerCase().replace(/^@+/, ""), p_max: 8, p_window_seconds: 900 });
  if (byName.data === false) return tooMany();

  let email: string | null = identifier.includes("@") ? identifier.toLowerCase() : null;
  if (!email) {
    const username = identifier.replace(/^@+/, "").toLowerCase();
    // Looks in finished profiles first, then in the name chosen at sign up (it only lives there until onboarding is done).
    const found = await admin.rpc("login_user_for_username", { candidate: username });
    if (typeof found.data === "string") {
      const u = await admin.auth.admin.getUserById(found.data);
      email = u.data.user?.email ?? null;
    }
  }
  if (!email) return reply({ error: NOT_RIGHT }, 401);

  // The password is checked by the normal sign in, exactly as if the app had done it with the email.
  const anon = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    // Only said when the password was right, so it does not reveal anything to a guesser.
    if (error && /confirm/i.test(error.message)) return reply({ error: "Confirm your email first. We sent you a link when you signed up." }, 401);
    return reply({ error: NOT_RIGHT }, 401);
  }
  return reply({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
});
