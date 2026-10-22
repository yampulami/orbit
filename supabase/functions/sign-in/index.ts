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

  let email: string | null = identifier.includes("@") ? identifier.toLowerCase() : null;
  if (!email) {
    const username = identifier.replace(/^@+/, "").toLowerCase();
    const found = await admin.from("student_profiles").select("user_id").eq("username", username).maybeSingle();
    if (found.data?.user_id) {
      const u = await admin.auth.admin.getUserById(found.data.user_id);
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
