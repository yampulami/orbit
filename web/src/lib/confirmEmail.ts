import { supabase } from "./supabase";
import { siteUrl } from "./siteUrl";
import { timedOutButSent } from "./passwordReset";

/** Confirming an email by a link that needs a button press. Many school and company mail systems open every link in a new email to check it, which
 *  would use up a one-time link before the person ever sees the email. So the email links to an Orbit page; that page only loads, and the account is
 *  confirmed when the person presses its button. A scanner can open the page but does not press the button. */
export type ConfirmParams = { tokenHash: string; type: "email" | "signup" };

/** Pure: what the link carries, or null if it is missing or odd. */
export function readConfirmParams(search: string): ConfirmParams | null {
  const q = new URLSearchParams(search);
  const tokenHash = (q.get("token_hash") ?? "").trim();
  const type = q.get("type");
  if (!/^[A-Za-z0-9_\-]{8,200}$/.test(tokenHash)) return null;
  return { tokenHash, type: type === "signup" ? "signup" : "email" };
}

/** What went wrong: the link is used or old, there were too many tries, or something else. */
export type ConfirmFailure = "used" | "slow" | "other";
export function confirmFailure(message: string): ConfirmFailure {
  if (/expired|invalid|not found|already/i.test(message)) return "used";
  if (/rate|too many|seconds/i.test(message)) return "slow";
  return "other";
}

/** Confirm the account. On success the person is signed in. Resolves to what went wrong, or null. */
export async function confirmWithToken(p: ConfirmParams): Promise<ConfirmFailure | null> {
  if (!supabase) return "other";
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: p.tokenHash, type: p.type });
  if (error || !data.session) return confirmFailure(error?.message ?? "");
  return null;
}

/** Email a new confirmation link. It says the same whether or not that address is waiting, so it cannot be used to find out who is on Orbit.
 *  Resolves to a message if it could not be sent, or null. */
export async function resendConfirmation(email: string): Promise<string | null> {
  if (!supabase) return "Sending a link needs the live app.";
  const { error } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: `${siteUrl()}/login` } });
  if (!error) return null;
  if (timedOutButSent(error)) return null;
  if (/rate|seconds|too many|limit/i.test(error.message)) return "Please wait a minute before asking for another email.";
  return "We could not send that. Check the email address and try again.";
}
